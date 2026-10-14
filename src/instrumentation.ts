/**
 * Runs once when the server boots, before the first request is served.
 *
 * Forcing the environment check here turns a missing or malformed variable into
 * a failed start instead of a 500 on whichever request happens to need it
 * first. It is skipped during `next build`, which has no real configuration.
 */
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { serverEnv } = await import("@/lib/env");
  const env = serverEnv();

  // Said once at boot rather than discovered by the first resident who never
  // receives a code.
  if (env.NODE_ENV === "production") {
    const { isSmsConfigured } = await import("@/lib/sms");
    const { isEmailConfigured } = await import("@/lib/mail");
    if (!isSmsConfigured()) {
      console.warn(
        env.AUTH_LOG_DELIVERY
          ? "[boot] SMS is not configured; AUTH_LOG_DELIVERY=1 writes sign-in codes to the log. Demo use only."
          : "[boot] SMS is not configured; phone sign-in is disabled.",
      );
    }
    if (!isEmailConfigured()) {
      console.warn(
        env.AUTH_LOG_DELIVERY
          ? "[boot] Email is not configured; AUTH_LOG_DELIVERY=1 writes sign-in links to the log. Demo use only."
          : "[boot] Email is not configured; email sign-in is disabled.",
      );
    }
    if (env.JCE_USE_MOCK) {
      console.warn(
        "[boot] JCE_USE_MOCK=1: cédula lookups return invented results.",
      );
    }
  }
}
