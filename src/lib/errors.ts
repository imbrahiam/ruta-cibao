/**
 * The machine-readable reason an oRPC error carries in `data.reason`, if any.
 * Procedures put the why there (`duplicate`, `too_far`, `outside_province`)
 * so the interface can say something specific instead of "something failed".
 */
export function errorReason(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return;
  const data = (error as { data: unknown }).data;
  if (!data || typeof data !== "object" || !("reason" in data)) return;
  const reason = (data as { reason: unknown }).reason;
  return typeof reason === "string" ? reason : undefined;
}

export function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return;
  const code = (error as { code: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** A fetch that never reached the server: offline, DNS, a dropped tower. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError;
}
