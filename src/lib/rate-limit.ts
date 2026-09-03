/**
 * Rate limiting backed by Postgres.
 *
 * Ported. Windows are fixed rather than sliding: the
 * key includes the window start, so each window is a fresh row and counting is
 * a single upsert with no read-modify-write race.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
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
export function getRequestClientKey(request: Request): string {
  const forwarded = env.TRUSTED_PROXY
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    : undefined;

  const address =
    forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";

  return hashLookup("request-client", address.slice(0, 128));
}

export async function consumeRateLimit(
  identifier: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
  const resetAt = new Date(windowStart + policy.windowMs);
  const key = hashLookup(
    "rate-limit",
    `${policy.scope}\0${identifier}\0${windowStart}`,
  );

  const [bucket] = await db
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

/** Drops windows that have already closed. Safe to run on any schedule. */
export async function clearExpiredRateLimits(
  now = new Date(),
): Promise<number> {
  const removed = await db
    .delete(rateLimitBuckets)
    .where(sql`${rateLimitBuckets.resetAt} <= ${now}`)
    .returning({ key: rateLimitBuckets.key });

  return removed.length;
}
