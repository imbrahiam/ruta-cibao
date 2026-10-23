/**
 * Web Push delivery.
 *
 * Optional by design: with no VAPID keypair configured, push is simply off and
 * the in-app notification centre still works. A municipality that never
 * generates keys gets a working platform, not a broken one.
 *
 * Endpoints go stale constantly — a browser reinstalled, a permission revoked,
 * a phone replaced. The server treats 404 and 410 as the subscription telling
 * us it is gone and deletes it, so the table does not fill with addresses
 * nobody is listening at.
 */
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { decryptSensitive } from "@/lib/crypto";
import { env } from "@/lib/env";

let configured: boolean | undefined;

function ensureConfigured(): boolean {
  if (configured !== undefined) return configured;

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    configured = false;
    return configured;
  }

  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  configured = true;
  return configured;
}

export function isPushEnabled(): boolean {
  return ensureConfigured();
}

export type PushPayload = {
  title: string;
  body: string;
  href?: string;
  tag?: string;
};

/** Sends to every registered device; transient failures trigger an outbox retry. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: decryptSensitive(subscription.p256dhCiphertext),
              auth: decryptSensitive(subscription.authCiphertext),
            },
          },
          JSON.stringify(payload),
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        // The push service is telling us this endpoint is dead. Believe it.
        if (status === 404 || status === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, subscription.id));
          return;
        }

        throw error;
      }
    }),
  );

  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    throw new Error(`Push delivery incomplete for ${failed.length} endpoints`);
  }

  return results.length - failed.length;
}
