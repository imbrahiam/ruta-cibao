/**
 * The bridge between Postgres and connected browsers.
 *
 * `NOTIFY` is used only to wake a reader, never to carry data. Each reader
 * drains `realtime_events` from its own cursor, which means a dropped
 * notification costs latency rather than an event, and a reconnecting browser
 * resumes exactly where it stopped.
 *
 * One LISTEN connection per process, shared by every open stream. It is a
 * dedicated client rather than a pooled one because LISTEN binds to the
 * session: a pooled connection handed back between notifications would stop
 * hearing them.
 */
import { and, asc, gt, inArray, or, sql } from "drizzle-orm";
import { Client } from "pg";
import { db } from "@/db";
import { type RealtimeEvent, realtimeEvents } from "@/db/schema";
import { env } from "@/lib/env";

const CHANNEL = "realtime_event";

/**
 * How far back the periodic sweep looks.
 *
 * Row ids are assigned before commit, so a long transaction can commit an id
 * *below* one a reader already passed. `id > cursor` alone would skip it
 * forever. The sweep therefore re-reads anything written in this window and
 * readers de-duplicate by id, which closes the gap for any transaction shorter
 * than it — comfortably every write this application makes.
 */
const SWEEP_LOOKBACK_SECONDS = 30;

type Nudge = () => void;

type Broker = {
  client?: Client;
  listeners: Set<Nudge>;
  connecting?: Promise<void>;
};

// Survives hot reloads in development; a new Set per reload would strand the
// old LISTEN connection with subscribers nobody can reach.
const globalForRealtime = globalThis as unknown as { realtimeBroker?: Broker };

globalForRealtime.realtimeBroker ??= { listeners: new Set() };
const broker: Broker = globalForRealtime.realtimeBroker;

async function connect(): Promise<void> {
  const client = new Client({ connectionString: env.DATABASE_URL });

  client.on("notification", () => {
    for (const listener of broker.listeners) listener();
  });

  client.on("error", (error) => {
    console.error("realtime listener error, will reconnect on next use", error);
    broker.client = undefined;
    broker.connecting = undefined;
    client.end().catch(() => {});
    // Readers keep their cursors, so the reconnect replays whatever the gap
    // held rather than losing it.
    for (const listener of broker.listeners) listener();
  });

  await client.connect();
  await client.query(`LISTEN ${CHANNEL}`);
  broker.client = client;
}

async function ensureListening(): Promise<void> {
  if (broker.client) return;
  broker.connecting ??= connect().finally(() => {
    broker.connecting = undefined;
  });
  await broker.connecting;
}

/** Registers a wake-up callback. The returned function unsubscribes. */
export async function onRealtimeNudge(listener: Nudge): Promise<() => void> {
  await ensureListening();
  broker.listeners.add(listener);
  return () => broker.listeners.delete(listener);
}

/**
 * Reads everything a stream has not delivered yet.
 *
 * With `includeSweep`, also re-reads the recent window described above; the
 * caller drops ids it has already sent.
 */
export async function drainEvents(options: {
  channels: string[];
  afterId: number;
  includeSweep?: boolean;
  limit?: number;
}): Promise<RealtimeEvent[]> {
  if (options.channels.length === 0) return [];

  const recent = sql`${realtimeEvents.createdAt} > now() - make_interval(secs => ${SWEEP_LOOKBACK_SECONDS})`;

  return db
    .select()
    .from(realtimeEvents)
    .where(
      and(
        inArray(realtimeEvents.channel, options.channels),
        options.includeSweep
          ? or(gt(realtimeEvents.id, options.afterId), recent)
          : gt(realtimeEvents.id, options.afterId),
      ),
    )
    .orderBy(asc(realtimeEvents.id))
    .limit(options.limit ?? 200);
}

/** How long a replayed event stays available to a reconnecting browser. */
const RETENTION_MINUTES = 60;

/**
 * Records something worth telling open clients about.
 *
 * The insert is what publishes: the trigger turns it into a NOTIFY, so callers
 * never touch the notification channel directly and an event can never exist
 * without a durable row behind it.
 */
export async function publishRealtimeEvent(event: {
  channel: string;
  municipalityId?: string | null;
  subjectType: string;
  subjectId: string;
  action: string;
  payload?: Record<string, unknown>;
  location?: { x: number; y: number } | null;
}): Promise<void> {
  await db.insert(realtimeEvents).values({
    channel: event.channel,
    municipalityId: event.municipalityId ?? null,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    action: event.action,
    payload: event.payload ?? {},
    location: event.location ?? null,
    expiresAt: new Date(Date.now() + RETENTION_MINUTES * 60 * 1_000),
  });
}

/** Channel name for a person's own notifications. */
export function userChannel(userId: string): string {
  return `user:${userId}`;
}

/**
 * Drops events past their retention window.
 *
 * The log exists so a reconnecting browser can catch up, not to be a history:
 * anything a client could still legitimately ask for is minutes old, and the
 * audit trail is what answers questions about the past. Called by the cleanup
 * job; safe to run at any time.
 */
export async function clearExpiredRealtimeEvents(
  now = new Date(),
): Promise<number> {
  const removed = await db
    .delete(realtimeEvents)
    .where(sql`${realtimeEvents.expiresAt} <= ${now}`)
    .returning({ id: realtimeEvents.id });

  return removed.length;
}
