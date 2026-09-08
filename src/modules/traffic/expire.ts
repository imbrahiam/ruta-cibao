import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { trafficReports } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { publishRealtimeEvent } from "@/lib/realtime";
import { TRAFFIC_CHANNEL } from "./report-traffic";

/**
 * Taking down the reports time has answered.
 *
 * The map already refuses to show a lapsed report, so this is not what keeps
 * the map honest — the query does. What this buys is everything downstream of
 * the row's state: the reporter's contribution list stops saying "activo", the
 * weekly figures can count what actually lapsed rather than what merely aged,
 * and every open browser loses the cone without waiting for its next fetch.
 *
 * Idempotent by construction. The update is guarded on `status = 'active'`, so
 * a run that overlaps the previous one, or a retry after a crash halfway
 * through, converges on the same result and publishes nothing twice.
 */
export async function expireTrafficReports(now = new Date()): Promise<number> {
  const expired = await db
    .update(trafficReports)
    .set({ status: "expired", resolvedAt: now })
    .where(
      and(
        eq(trafficReports.status, "active"),
        sql`${trafficReports.expiresAt} <= ${now}`,
      ),
    )
    .returning({
      id: trafficReports.id,
      municipalityId: trafficReports.municipalityId,
      location: trafficReports.location,
    });

  for (const report of expired) {
    await publishRealtimeEvent({
      channel: TRAFFIC_CHANNEL,
      municipalityId: report.municipalityId,
      subjectType: "traffic_report",
      subjectId: report.id,
      action: "deleted",
      payload: { reason: "expired" },
      location: report.location,
    });

    // No actor: nobody decided this, the clock did. A null `actorUserId` is
    // what the trail uses to say so.
    await recordAudit({
      actorUserId: null,
      action: "traffic.expired",
      subjectType: "traffic_report",
      subjectId: report.id,
      municipalityId: report.municipalityId,
    });
  }

  return expired.length;
}
