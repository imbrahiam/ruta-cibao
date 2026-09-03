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
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { withOpenKeys } from "@/i18n/open-keys";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import { sendPushToUser } from "@/lib/push";
import { publishRealtimeEvent, userChannel } from "@/lib/realtime";

export type NotifyInput = {
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
      params: input.params ?? {},
      href: input.href ?? null,
    })
    .returning({ id: notifications.id });

  if (!created) return;

  // Wakes any tab this person has open, so the bell updates without polling.
  await publishRealtimeEvent({
    channel: userChannel(input.userId),
    subjectType: "notification",
    subjectId: created.id,
    action: "created",
    payload: { messageKey: input.messageKey },
  });

  // Rendered once, here, for the channels that carry text rather than a key.
  const t = await getTranslations("notifications");
  const title = t("title");
  const body = withOpenKeys(t)(input.messageKey, input.params);

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
          html: `<p>${body}</p>${input.href ? `<p><a href="${new URL(input.href, env.APP_URL).toString()}">Ver en Ruta Cibao</a></p>` : ""}`,
        })
      : Promise.resolve(),
  ]);
}
