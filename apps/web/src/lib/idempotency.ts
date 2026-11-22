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
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { type DbTransaction, db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { hashContent } from "@/lib/crypto";

const RETENTION_HOURS = 24;

/**
 * An oRPC error so callers get 409 rather than 500: a client that retries on
 * a server error would otherwise resend the same refused request forever.
 */
export class IdempotencyConflictError extends ORPCError<"CONFLICT", undefined> {
  constructor() {
    super("CONFLICT", {
      message: "This idempotency key was already used with different content.",
    });
  }
}

export type IdempotencyOutcome<T> = { replayed: boolean; result: T };

export async function withIdempotency<T>(options: {
  key: string;
  userId: string | null;
  /** The request body, so a reused key carrying different content is caught. */
  request: unknown;
  run: (tx: DbTransaction) => Promise<T>;
}): Promise<IdempotencyOutcome<T>> {
  const requestHash = hashContent(
    new TextEncoder().encode(JSON.stringify(options.request)),
  );
  const expiresAt = new Date(Date.now() + RETENTION_HOURS * 60 * 60 * 1_000);

  return db.transaction(async (tx) => {
    const claimed = await tx
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
      const [existing] = await tx
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.key, options.key))
        .limit(1);

      if (
        existing &&
        (existing.requestHash !== requestHash ||
          existing.userId !== options.userId)
      ) {
        throw new IdempotencyConflictError();
      }

      if (!existing || existing.responseStatus === null) {
        throw new IdempotencyInFlightError();
      }

      return { replayed: true, result: existing.responseBody as T };
    }

    // The claim, domain write and saved response commit together. A crash at
    // any point rolls all three back, so the next retry starts cleanly.
    const result = await options.run(tx);

    await tx
      .update(idempotencyKeys)
      .set({ responseStatus: 200, responseBody: result as never })
      .where(
        and(
          eq(idempotencyKeys.key, options.key),
          sql`${idempotencyKeys.responseStatus} is null`,
        ),
      );

    return { replayed: false, result };
  });
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
