/**
 * Sending someone a notification.
 *
 * One call, three destinations, and only the in-app one is guaranteed. Native
 * push needs APNs credentials and a registered device; email needs a Resend
 * key. External channels respect the recipient's current preferences without
 * removing their durable in-app history.
 *
 * The stored row holds a catalogue key and its parameters rather than a
 * rendered sentence. Rendering happens at read time, so a notification written
 * today still reads correctly in whatever language the recipient picks
 * tomorrow, and the catalogue stays the single source of user-facing text.
 */

import { type AppTarget, parseAppTarget } from "@ruta/shared/app-target";
import { catalogues } from "@ruta/shared/messages";
import { renderNotification } from "@ruta/shared/open-keys";
import { and, eq, gt } from "drizzle-orm";
import { createTranslator } from "next-intl";
import { z } from "zod";
import { type DbTransaction, db } from "@/db";
import {
  notificationPreferences,
  notifications,
  trafficReports,
  user,
} from "@/db/schema";
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

  const [preferences] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, notification.userId))
    .limit(1);
  const allowsCaseUpdate =
    !notification.messageKey.startsWith("notifications.consultation") ||
    preferences?.caseUpdatesEnabled !== false;
  let allowsTraffic = true;
  if (notification.messageKey === "notifications.trafficNearby") {
    allowsTraffic = false;
    let target: AppTarget | null = null;
    try {
      target = parseAppTarget(notification.href ?? "");
    } catch {
      // expected: an obsolete or malformed target must not bypass subscriptions.
    }
    if (
      preferences?.trafficEnabled &&
      target?.kind === "traffic" &&
      z.uuid().safeParse(target.ref).success
    ) {
      const [report] = await db
        .select({
          municipalityId: trafficReports.municipalityId,
          categoryId: trafficReports.categoryId,
        })
        .from(trafficReports)
        .where(
          and(
            eq(trafficReports.id, target.ref),
            eq(trafficReports.status, "active"),
            gt(trafficReports.expiresAt, new Date()),
          ),
        )
        .limit(1);
      allowsTraffic = Boolean(
        report &&
          preferences.municipalityIds.includes(report.municipalityId) &&
          (preferences.categoryIds.length === 0 ||
            preferences.categoryIds.includes(report.categoryId)),
      );
    }
  }
  const wantsPush = input.push && allowsCaseUpdate && allowsTraffic;
  const wantsEmail =
    input.email &&
    allowsCaseUpdate &&
    allowsTraffic &&
    preferences?.emailEnabled !== false &&
    isEmailConfigured() &&
    isDeliverableAddress(row.email);

  const deliverEmail = async () => {
    if (!wantsEmail) return;
    const catalogue = createTranslator({
      locale: routing.defaultLocale,
      messages: catalogues[routing.defaultLocale],
    });
    const body = renderNotification(
      catalogue,
      notification.messageKey,
      notification.params,
    );
    await sendEmail({
      to: row.email,
      subject: catalogue("notifications.title"),
      text: `${body}\n\n${notification.href ? new URL(notification.href, env.APP_URL).toString() : ""}`.trim(),
      html: `<p>${escapeHtml(body)}</p>${notification.href ? `<p><a href="${escapeHtml(new URL(notification.href, env.APP_URL).toString())}">${escapeHtml(catalogue("notifications.open"))}</a></p>` : ""}`,
    });
  };

  // An external outage retries the outbox job, never the original civic mutation.
  const results = await Promise.allSettled([
    wantsPush
      ? sendPushToUser(notification.userId, {
          notificationId: notification.id,
          href: notification.href ?? undefined,
        })
      : Promise.resolve(0),
    deliverEmail(),
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
