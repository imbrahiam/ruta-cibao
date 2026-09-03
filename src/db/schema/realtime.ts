import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { point } from "../types";
import { municipalities } from "./geography";

/**
 * The durable event log behind the live map.
 *
 * `LISTEN/NOTIFY` alone would be simpler, but it is fire-and-forget: a client
 * disconnected at the moment of the NOTIFY loses that event permanently, with
 * no way to ask what it missed. This province has intermittent connectivity —
 * it is the reason the app has an offline queue at all — so building realtime
 * on the assumption that nobody disconnects would fail exactly where it
 * matters.
 *
 * So the table is the source of truth and NOTIFY is only the nudge. The SSE
 * stream tags each message with the row id; a reconnecting browser sends
 * `Last-Event-ID` on its own, per the SSE spec, and the server replays from
 * here. A dropout on a hillside becomes a gap that fills itself.
 *
 * NOTIFY's payload is capped at 8000 bytes anyway, so it was always going to
 * carry an id rather than the data.
 */
export const realtimeEvents = pgTable(
  "realtime_events",
  {
    /**
     * Monotonic, and the cursor clients resume from.
     *
     * Ids are assigned before commit, so two concurrent writers can commit out
     * of order and a reader could step past an id that lands a moment later.
     * The replay therefore overlaps slightly and clients de-duplicate by id —
     * see `replayWindowStart` in `@/lib/realtime`.
     */
    id: bigserial({ mode: "number" }).primaryKey(),
    /** Coarse topic: `traffic`, `places`, `consultations`, `user:<id>`. */
    channel: text().notNull(),
    municipalityId: text().references(() => municipalities.id, {
      onDelete: "cascade",
    }),
    subjectType: text().notNull(),
    subjectId: text().notNull(),
    action: text().notNull(),
    /** Small and never personal: enough for the client to patch its cache. */
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /** Lets a client ask only for what happened inside the map viewport. */
    location: point(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Replay is for reconnects, not history; a job drops rows past this. */
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    index("realtime_events_channel_idx").on(table.channel, table.id),
    index("realtime_events_created_idx").on(table.createdAt),
    index("realtime_events_location_idx").using("gist", table.location),
  ],
);

export type RealtimeEvent = typeof realtimeEvents.$inferSelect;
