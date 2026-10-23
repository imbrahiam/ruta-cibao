/** What the sign-in screens say about a failed request, as a catalogue key. */
export type SignInErrorKey =
  | "codeInvalid"
  | "codeExpired"
  | "tooManyAttempts"
  | "rateLimited"
  | "sendFailed";

/**
 * Maps Better Auth's error (a code, a status, or both) to one sentence the
 * person can act on. Anything unrecognised is a delivery failure, which tells
 * them to try again rather than blaming what they typed.
 */
export function signInErrorKey(
  error: { code?: string; status?: number } | null | undefined,
): SignInErrorKey {
  const code = error?.code ?? "";
  if (error?.status === 429 || code === "TOO_MANY_REQUESTS")
    return "rateLimited";
  if (code.includes("EXPIRED")) return "codeExpired";
  if (code.includes("TOO_MANY_ATTEMPTS")) return "tooManyAttempts";
  if (code.includes("INVALID") || code.includes("OTP")) return "codeInvalid";
  return "sendFailed";
}
