/**
 * Sending someone a notification.
 *
 * One call, three destinations, and only the in-app one is guaranteed. Push
 * needs a VAPID keypair and a registered device; email needs a Resend key.
 * Both are optional, and the notification centre is what makes that acceptable
 * — nothing is lost when a channel is off, it just arrives later.
 *
 * The stored row holds a catalogue key and its parameters rather than a
 * rendered sentence. Rendering happens at read time, so a notification written
 * today still reads correctly in whatever language the recipient picks
 * tomorrow, and the catalogue stays the single source of user-facing text.
 */

import { catalogues } from "@ruta/shared/messages";
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { type DbTransaction, db } from "@/db";
import { notifications, user } from "@/db/schema";
import { renderNotification } from "@/i18n/open-keys";
import { routing } from "@/i18n/routing";
import { recordAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs/outbox";
import { QUEUES } from "@/lib/jobs/queues";
import { isDeliverableAddress, isEmailConfigured, sendEmail } from "@/lib/mail";
import { sendPushToUser } from "@/lib/push";
import { publishRealtimeEvent, userChannel } from "@/lib/realtime";

export type NotifyInput = {
  dedupeKey?: string;
  userId: string;
  /** Key into `messages/<locale>.json`, e.g. `notifications.placeApproved`. */
  messageKey: string;
  params?: Record<string, string | number>;
  /** Where tapping it should land. */
  href?: string;
  /** Address for the email copy. Omit to skip email for this notification. */
  email?: string;
  channels?: { push?: boolean; email?: boolean };
};

export async function notify(
  input: NotifyInput,
  transaction?: DbTransaction,
): Promise<void> {
  const run = async (tx: DbTransaction) => {
    const [created] = await tx
      .insert(notifications)
      .values({
        userId: input.userId,
        messageKey: input.messageKey,
        dedupeKey: input.dedupeKey,
        params: input.params ?? {},
        href: input.href ?? null,
      })
      .onConflictDoNothing({ target: notifications.dedupeKey })
      .returning({ id: notifications.id });

    if (!created) return;
    await recordAudit(
      {
        action: "notification.created",
        subjectType: "notification",
        subjectId: created.id,
      },
      tx,
    );

    // Wakes any tab this person has open, so the bell updates without polling.
    await publishRealtimeEvent(
      {
        channel: userChannel(input.userId),
        subjectType: "notification",
        subjectId: created.id,
        action: "created",
        payload: { messageKey: input.messageKey },
      },
      tx,
    );

    await enqueueJob(tx, QUEUES.notificationDeliver, {
      notificationId: created.id,
      push: input.channels?.push ?? true,
      email: input.channels?.email ?? false,
    });
  };
  if (transaction) await run(transaction);
  else await db.transaction(run);
}

/** The outbox only holds an id; email is resolved at delivery time. */
export async function deliverNotification(input: {
  notificationId: string;
  push: boolean;
  email: boolean;
}): Promise<void> {
  const [row] = await db
    .select({ notification: notifications, email: user.email })
    .from(notifications)
    .innerJoin(user, eq(user.id, notifications.userId))
    .where(eq(notifications.id, input.notificationId))
    .limit(1);
  if (!row) return;
  const notification = row.notification;

  // Rendered once, here, for the channels that carry text rather than a key.
  // Two translators, because they answer different questions: the scoped one
  // writes the app's own chrome, and the rooted one resolves a stored key,
  // which is a full catalogue path and would otherwise be looked up under
  // `notifications.notifications.…`.
  const messages = catalogues[routing.defaultLocale];
  const catalogue = createTranslator({
    locale: routing.defaultLocale,
    messages,
  });
  const title = catalogue("notifications.title");
  const body = renderNotification(
    catalogue,
    notification.messageKey,
    notification.params,
  );

  const wantsPush = input.push;
  const wantsEmail =
    input.email && isEmailConfigured() && isDeliverableAddress(row.email);

  // Delivery is best-effort: a dead push endpoint or a mail outage must not
  // roll back the thing that caused the notification in the first place.
  const results = await Promise.allSettled([
    wantsPush
      ? sendPushToUser(notification.userId, {
          title,
          body,
          href: notification.href ?? undefined,
          tag: notification.id,
        })
      : Promise.resolve(0),

    wantsEmail
      ? sendEmail({
          to: row.email,
          subject: title,
          text: `${body}\n\n${notification.href ? new URL(notification.href, env.APP_URL).toString() : ""}`.trim(),
          html: `<p>${escapeHtml(body)}</p>${notification.href ? `<p><a href="${escapeHtml(new URL(notification.href, env.APP_URL).toString())}">${escapeHtml(catalogue("notifications.open"))}</a></p>` : ""}`,
        })
      : Promise.resolve(),
  ]);
  if (results.some((result) => result.status === "rejected"))
    throw new Error("Notification delivery incomplete");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
