/**
 * Whether an unconfigured channel may fall back to the server log.
 *
 * Shared by `sms.ts` and `mail.ts`, so the two cannot disagree about it: in
 * development the log is the delivery channel, and in production it is a leak.
 * A production server with no SMS provider therefore refuses to "send" a code,
 * and the sign-in screen stops offering that route at all.
 */
import { env } from "@/lib/env";

export function logDeliveryAllowed(): boolean {
  return env.NODE_ENV !== "production" || env.AUTH_LOG_DELIVERY;
}
