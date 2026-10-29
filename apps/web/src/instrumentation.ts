import { logWarn } from "@/lib/log";

/**
 * Runs once when the server boots, before the first request is served.
 *
 * Forcing the environment check here turns a missing or malformed variable into
 * a failed start instead of a 500 on whichever request happens to need it
 * first. It is skipped during `next build`, which has no real configuration.
 */
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Dynamic on purpose: Next loads this file in every runtime (edge included)
  // and at build time, where the server-only modules must not be evaluated.
  const { serverEnv } = await import("@/lib/env");
  const env = serverEnv();

  // Said once at boot rather than discovered by the first resident who never
  // receives a code.
  if (env.NODE_ENV === "production") {
    const { isVerifyConfigured } = await import("@/lib/sms");
    const { isEmailConfigured } = await import("@/lib/mail");
    if (!isVerifyConfigured()) {
      logWarn("boot.sms_disabled");
    }
    if (!isEmailConfigured()) {
      logWarn("boot.email_disabled");
    }
  }
}
