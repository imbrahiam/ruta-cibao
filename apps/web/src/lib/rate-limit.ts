/**
 * Rate limiting backed by Postgres.
 *
 * Ported. Windows are fixed rather than sliding: the
 * key includes the window start, so each window is a fresh row and counting is
 * a single upsert with no read-modify-write race.
 */
import { sql } from "drizzle-orm";
import { type Db, type DbTransaction, db } from "@/db";
import { rateLimitBuckets, rollingRateLimits } from "@/db/schema";
import { hashLookup } from "@/lib/crypto";
import { env } from "@/lib/env";

export type RateLimitPolicy = {
  /** Requests allowed per window. */
  limit: number;
  /** Namespace, so two features cannot share a bucket by accident. */
  scope: string;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Identifies the caller for limiting purposes.
 *
 * `X-Forwarded-For` is only trusted when TRUSTED_PROXY says a reverse proxy we
 * control sets it. Trusting it unconditionally would let any client forge an
 * address per request and walk straight through the limiter.
 *
 * The result is hashed, so the limiter never stores a readable IP.
 */
export function getRequestClientKey(headers: Headers): string {
  // The last entry is the one our proxy wrote. Caddy replaces the header, but
  // a proxy that appends (nginx's usual setup) keeps whatever the client sent
  // in front, so the first entry would be the client's to choose.
  const forwarded = env.TRUSTED_PROXY
    ? headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    : undefined;

  const address =
    forwarded ||
    (env.TRUSTED_PROXY ? headers.get("x-real-ip")?.trim() : undefined) ||
    "unknown";

  return hashLookup("request-client", address.slice(0, 128));
}

export async function consumeRateLimit(
  identifier: string,
  policy: RateLimitPolicy,
  executor: Db | DbTransaction = db,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
  const resetAt = new Date(windowStart + policy.windowMs);
  const key = hashLookup(
    "rate-limit",
    `${policy.scope}\0${identifier}\0${windowStart}`,
  );

  const [bucket] = await executor
    .insert(rateLimitBuckets)
    .values({ key, scope: policy.scope, requestCount: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: { requestCount: sql`${rateLimitBuckets.requestCount} + 1` },
    })
    .returning({ requestCount: rateLimitBuckets.requestCount });

  // A missing row should be impossible, but failing closed is the safe default
  // for a limiter: treat it as over the limit rather than as a free request.
  const requestCount = bucket?.requestCount ?? policy.limit + 1;

  return {
    allowed: requestCount <= policy.limit,
    remaining: Math.max(0, policy.limit - requestCount),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetAt.getTime() - now) / 1_000),
    ),
  };
}

/** Serialize reservations in Postgres so all instances share the same budget. */
export async function consumeRollingRateLimit(
  identifier: string,
  policy: RateLimitPolicy,
  transaction?: DbTransaction,
): Promise<RateLimitResult> {
  const run = async (tx: DbTransaction) => {
    const key = hashLookup(
      "rolling-rate-limit",
      `${policy.scope}\0${identifier}`,
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
    );
    const [window] = await tx
      .select({
        count: sql<number>`count(*)::int`,
        earliest: sql<Date | null>`min(${rollingRateLimits.expiresAt})`,
      })
      .from(rollingRateLimits)
      .where(
        sql`${rollingRateLimits.key} = ${key} and ${rollingRateLimits.expiresAt} > clock_timestamp()`,
      );
    const count = window?.count ?? 0;
    const allowed = count < policy.limit;
    if (allowed)
      await tx.insert(rollingRateLimits).values({
        key,
        expiresAt: sql`clock_timestamp() + ${policy.windowMs} * interval '1 millisecond'`,
      });
    return {
      allowed,
      remaining: Math.max(0, policy.limit - count - (allowed ? 1 : 0)),
      retryAfterSeconds: window?.earliest
        ? Math.max(
            1,
            Math.ceil(
              (new Date(window.earliest).getTime() - Date.now()) / 1000,
            ),
          )
        : Math.ceil(policy.windowMs / 1000),
    };
  };
  return transaction ? run(transaction) : db.transaction(run);
}

/** Drops windows that have already closed. Safe to run on any schedule. */
export async function clearExpiredRateLimits(
  now = new Date(),
): Promise<number> {
  const removed = await db
    .delete(rateLimitBuckets)
    .where(sql`${rateLimitBuckets.resetAt} <= ${now}`)
    .returning({ key: rateLimitBuckets.key });

  const rolling = await db
    .delete(rollingRateLimits)
    .where(sql`${rollingRateLimits.expiresAt} <= ${now}`)
    .returning({ id: rollingRateLimits.id });
  return removed.length + rolling.length;
}
