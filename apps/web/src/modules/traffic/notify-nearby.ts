import { appTargetHref } from "@ruta/shared/app-target";
import { and, arrayContains, eq, gt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  notificationPreferences,
  trafficReports,
} from "@/db/schema";
import { notify } from "@/modules/notifications/notify";

/**
 * Fan out only to explicit municipality/category subscribers. Saved places,
 * contributions and a person's location never imply notification consent.
 *
 * The queued job writes durable inbox/outbox rows in the same transaction.
 * Share locks serialize report removal and preference mutes with that fan-out;
 * external delivery also rechecks the latest preferences before sending.
 */
export async function notifyNearbyOfTraffic(reportId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select({
        id: trafficReports.id,
        categoryId: trafficReports.categoryId,
        municipalityId: trafficReports.municipalityId,
        reportedByUserId: trafficReports.reportedByUserId,
        categoryName: categories.name,
      })
      .from(trafficReports)
      .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
      .where(
        and(
          eq(trafficReports.id, reportId),
          eq(trafficReports.status, "active"),
          gt(trafficReports.expiresAt, new Date()),
          eq(categories.kind, "traffic"),
          eq(categories.isActive, true),
        ),
      )
      .for("share");
    if (!report) return 0;

    const recipients = await tx
      .select({ userId: notificationPreferences.userId })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.trafficEnabled, true),
          arrayContains(notificationPreferences.municipalityIds, [
            report.municipalityId,
          ]),
          or(
            sql`cardinality(${notificationPreferences.categoryIds}) = 0`,
            arrayContains(notificationPreferences.categoryIds, [
              report.categoryId,
            ]),
          ),
          report.reportedByUserId
            ? ne(notificationPreferences.userId, report.reportedByUserId)
            : undefined,
        ),
      )
      .for("share");

    for (const recipient of recipients) {
      await notify(
        {
          dedupeKey: `traffic:${report.id}:${recipient.userId}`,
          userId: recipient.userId,
          messageKey: "notifications.trafficNearby",
          // Reports publish before their free text is reviewed. Never copy it
          // into notifications, including the durable in-app inbox.
          params: { description: report.categoryName },
          href: appTargetHref({ kind: "traffic", ref: report.id }),
          channels: { push: true, email: false },
        },
        tx,
      );
    }
    return recipients.length;
  });
}
