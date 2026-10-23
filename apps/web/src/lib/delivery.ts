/**
 * Whether an unconfigured channel may fall back to the server log.
 *
 * Shared by `sms.ts` and `mail.ts`, so the two cannot disagree about it. Only
 * outside production, and only while `AUTH_LOG_DELIVERY` is on (its default
 * there): a code in the log is a way into somebody else's account for anyone
 * who can read the log, so environment validation refuses it in production.
 */
import { env } from "@/lib/env";

export function logDeliveryAllowed(): boolean {
  return env.NODE_ENV !== "production" && env.AUTH_LOG_DELIVERY;
}
