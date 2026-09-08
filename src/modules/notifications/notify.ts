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
import { createTranslator } from "next-intl";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { renderNotification } from "@/i18n/open-keys";
import { routing } from "@/i18n/routing";
import { recordAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
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

export async function notify(input: NotifyInput): Promise<void> {
  const [created] = await db
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
  await recordAudit({
    action: "notification.created",
    subjectType: "notification",
    subjectId: created.id,
  });

  // Wakes any tab this person has open, so the bell updates without polling.
  await publishRealtimeEvent({
    channel: userChannel(input.userId),
    subjectType: "notification",
    subjectId: created.id,
    action: "created",
    payload: { messageKey: input.messageKey },
  });

  // Rendered once, here, for the channels that carry text rather than a key.
  // Two translators, because they answer different questions: the scoped one
  // writes the app's own chrome, and the rooted one resolves a stored key,
  // which is a full catalogue path and would otherwise be looked up under
  // `notifications.notifications.…`.
  const messages = (
    await import(`../../../messages/${routing.defaultLocale}.json`)
  ).default;
  const catalogue = createTranslator({
    locale: routing.defaultLocale,
    messages,
  });
  const title = catalogue("notifications.title");
  const body = renderNotification(catalogue, input.messageKey, input.params);

  const wantsPush = input.channels?.push ?? true;
  const wantsEmail = (input.channels?.email ?? false) && Boolean(input.email);

  // Delivery is best-effort: a dead push endpoint or a mail outage must not
  // roll back the thing that caused the notification in the first place.
  await Promise.allSettled([
    wantsPush
      ? sendPushToUser(input.userId, {
          title,
          body,
          href: input.href,
          tag: input.messageKey,
        })
      : Promise.resolve(0),

    wantsEmail && input.email
      ? sendEmail({
          to: input.email,
          subject: title,
          text: `${body}\n\n${input.href ? new URL(input.href, env.APP_URL).toString() : ""}`.trim(),
          html: `<p>${escapeHtml(body)}</p>${input.href ? `<p><a href="${escapeHtml(new URL(input.href, env.APP_URL).toString())}">${escapeHtml(catalogue("notifications.open"))}</a></p>` : ""}`,
        })
      : Promise.resolve(),
  ]);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
