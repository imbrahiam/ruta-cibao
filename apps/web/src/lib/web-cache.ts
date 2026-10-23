import { timingSafeEqual } from "node:crypto";
import { hashLookup } from "@/lib/crypto";
import { env } from "@/lib/env";

/**
 * Dropping the web process's public caches from another process.
 *
 * Next's cache tags can only be invalidated inside the Next server, but the
 * worker is its own process and is where account cleanup and offline snapshot
 * rebuilds finish. It calls the internal route below, which only accepts a
 * token derived from the application secret both processes already share, so
 * no extra credential exists to leak or rotate.
 *
 * Best effort by design: the caches expire on their own within the hour, and
 * a failed refresh must never fail the removal that caused it.
 */
export const PUBLIC_CACHE_TAGS = ["places-geojson", "places-tiles"] as const;

export function internalToken(): string {
  return hashLookup("internal-revalidate", "v1");
}

export function isInternalToken(candidate: string | null): boolean {
  if (!candidate) return false;
  const expected = Buffer.from(internalToken());
  const actual = Buffer.from(candidate);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function refreshPublicCaches(): Promise<boolean> {
  try {
    const origin = env.INTERNAL_APP_URL ?? env.APP_URL;
    const response = await fetch(`${origin}/api/internal/revalidate`, {
      method: "POST",
      headers: { "x-internal-token": internalToken() },
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    console.warn("public cache refresh failed; entries expire on their own");
    return false;
  }
}
