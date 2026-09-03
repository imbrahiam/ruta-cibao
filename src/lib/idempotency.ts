/**
 * Making a retried mutation safe.
 *
 * A phone in a dead zone queues a report and sends it when signal returns —
 * sometimes twice, because the first attempt's response never made it back.
 * Without this, the second attempt creates a second report and the citizen sees
 * their own duplicate on the map.
 *
 * The key is claimed with an insert. Whoever wins runs the work; anyone
 * arriving with the same key afterwards gets the stored answer instead of doing
 * it again. That makes the claim atomic — two requests racing cannot both
 * decide they are first.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { hashContent } from "@/lib/crypto";

const RETENTION_HOURS = 24;

export class IdempotencyConflictError extends Error {
  constructor() {
    super("This idempotency key was already used with different content.");
    this.name = "IdempotencyConflictError";
  }
}

export type IdempotencyOutcome<T> = { replayed: boolean; result: T };

export async function withIdempotency<T>(options: {
  key: string;
  userId: string | null;
  /** The request body, so a reused key carrying different content is caught. */
  request: unknown;
  run: () => Promise<T>;
}): Promise<IdempotencyOutcome<T>> {
  const requestHash = hashContent(
    new TextEncoder().encode(JSON.stringify(options.request)),
  );
  const expiresAt = new Date(Date.now() + RETENTION_HOURS * 60 * 60 * 1_000);

  const claimed = await db
    .insert(idempotencyKeys)
    .values({
      key: options.key,
      userId: options.userId,
      requestHash,
      expiresAt,
    })
    .onConflictDoNothing({ target: idempotencyKeys.key })
    .returning({ key: idempotencyKeys.key });

  if (claimed.length === 0) {
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, options.key))
      .limit(1);

    // The same key with a different body is a client bug, not a retry, and
    // silently returning the first response would hide it.
    if (existing && existing.requestHash !== requestHash) {
      throw new IdempotencyConflictError();
    }

    // The winner may still be working. Its response lands on the row when it
    // finishes; until then the caller is told to try again rather than being
    // handed an empty result.
    if (!existing || existing.responseStatus === null) {
      throw new IdempotencyInFlightError();
    }

    return { replayed: true, result: existing.responseBody as T };
  }

  const result = await options.run();

  await db
    .update(idempotencyKeys)
    .set({ responseStatus: 200, responseBody: result as never })
    .where(
      and(
        eq(idempotencyKeys.key, options.key),
        sql`${idempotencyKeys.responseStatus} is null`,
      ),
    );

  return { replayed: false, result };
}

export class IdempotencyInFlightError extends Error {
  constructor() {
    super("An identical request is still being processed. Try again shortly.");
    this.name = "IdempotencyInFlightError";
  }
}

/** Drops keys past their retention window. Safe to run at any time. */
export async function clearExpiredIdempotencyKeys(
  now = new Date(),
): Promise<number> {
  const removed = await db
    .delete(idempotencyKeys)
    .where(sql`${idempotencyKeys.expiresAt} <= ${now}`)
    .returning({ key: idempotencyKeys.key });

  return removed.length;
}
