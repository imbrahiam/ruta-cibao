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
  serverEnv();
}
