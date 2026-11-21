/**
 * How long a sign-in code request has to wait, and how to say it.
 *
 * The server refuses a send with `OTP_RATE_LIMITED` and says how many seconds
 * are left (`retryAfter`); the UI counts that down instead of leaving people
 * guessing. A code that was sent stays usable for ten minutes, so coming back
 * to the same address goes straight to typing it.
 */

/** A code stays valid this long after it is sent (the server's `expiresIn`). */
export const CODE_VALID_MS = 600_000;

/** Waits longer than this read as a clock time rather than a countdown. */
export const COUNTDOWN_LIMIT_SECONDS = 120;

/** When the server refused without saying, wait the usual resend minute. */
const FALLBACK_WAIT_SECONDS = 60;

/** The error's code, when it has one. */
export function failureCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
}

/** Seconds the server asked to wait, or `null` when the failure is not a wait. */
export function waitFromFailure(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const failure = error as {
    code?: unknown;
    status?: unknown;
    retryAfter?: unknown;
  };
  const limited =
    failure.code === "OTP_RATE_LIMITED" ||
    failure.code === "TOO_MANY_REQUESTS" ||
    failure.status === 429;
  if (!limited) return null;
  const seconds = Number(failure.retryAfter);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : FALLBACK_WAIT_SECONDS;
}

/** Whole seconds left until `until` (ms since the epoch), never negative. */
export function secondsLeft(until: number | undefined, now: number): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** `0:42`, `1:05`, `12:00`: minutes and zero-padded seconds. */
export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}
