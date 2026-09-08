import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  TRAFFIC_REPORT_TTL_MINUTES,
  trafficConfirmations,
  trafficReports,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { publishRealtimeEvent } from "@/lib/realtime";
import type { MemberViewer } from "@/modules/access/viewer";
import { confirmationWeight } from "@/modules/places/trust";
import type { ConfirmTrafficInput } from "./contracts";
import { TRAFFIC_CHANNEL, TrafficError } from "./report-traffic";

/**
 * What the neighbours say about a report that is already on the map.
 *
 * This is the mechanism that lets traffic publish without moderation. A report
 * nobody vouches for lapses in six hours; one people keep confirming stays as
 * long as it is true; one enough people contradict comes down without waiting
 * for an official to notice. The community does the timing, a human only does
 * the exceptions.
 */

/** Enough weight to say it is over. Two verified residents, or four visitors. */
const CLEARED_SCORE = 4;

/**
 * How much a "sigue ahí" buys the report.
 *
 * Less than the original lifetime on purpose: confirming should keep a real
 * problem visible, not let three people hold a cone on the map indefinitely by
 * tapping once an hour.
 */
const EXTENSION_MINUTES = TRAFFIC_REPORT_TTL_MINUTES / 2;

export type TrafficTally = {
  stillWeight: number;
  clearedWeight: number;
  stillCount: number;
  clearedCount: number;
};

/** The tallies for one report, in a single round trip. */
export async function trafficTally(
  executor: Db,
  reportId: string,
): Promise<TrafficTally> {
  const [row] = await executor
    .select({
      stillWeight: sql<number>`coalesce(sum(case when ${trafficConfirmations.verdict} = 'still' then ${trafficConfirmations.weight} else 0 end), 0)::int`,
      clearedWeight: sql<number>`coalesce(sum(case when ${trafficConfirmations.verdict} = 'cleared' then ${trafficConfirmations.weight} else 0 end), 0)::int`,
      stillCount: sql<number>`count(*) filter (where ${trafficConfirmations.verdict} = 'still')::int`,
      clearedCount: sql<number>`count(*) filter (where ${trafficConfirmations.verdict} = 'cleared')::int`,
    })
    .from(trafficConfirmations)
    .where(eq(trafficConfirmations.reportId, reportId));

  return {
    stillWeight: row?.stillWeight ?? 0,
    clearedWeight: row?.clearedWeight ?? 0,
    stillCount: row?.stillCount ?? 0,
    clearedCount: row?.clearedCount ?? 0,
  };
}

/**
 * Recording one person's answer.
 *
 * Idempotent through the unique index rather than an idempotency key: this is a
 * toggle, and tapping "sigue ahí" twice ends in the same row either way.
 */
export async function confirmTraffic(
  executor: Db,
  viewer: MemberViewer,
  input: ConfirmTrafficInput,
) {
  const [report] = await executor
    .select({
      id: trafficReports.id,
      status: trafficReports.status,
      expiresAt: trafficReports.expiresAt,
      municipalityId: trafficReports.municipalityId,
      reportedByUserId: trafficReports.reportedByUserId,
      location: trafficReports.location,
    })
    .from(trafficReports)
    .where(eq(trafficReports.id, input.reportId))
    .limit(1);

  if (!report) throw new TrafficError("not_found");
  if (report.status !== "active") throw new TrafficError("already_resolved");
  // Vouching for your own report is not evidence of anything.
  if (report.reportedByUserId === viewer.userId) {
    throw new TrafficError("own_report");
  }

  const weight = confirmationWeight(viewer);

  await executor
    .insert(trafficConfirmations)
    .values({
      reportId: report.id,
      userId: viewer.userId,
      verdict: input.verdict,
      weight,
    })
    .onConflictDoUpdate({
      target: [trafficConfirmations.reportId, trafficConfirmations.userId],
      set: { verdict: input.verdict, weight, updatedAt: new Date() },
    });

  const tally = await trafficTally(executor, report.id);
  const cleared = tally.clearedWeight >= CLEARED_SCORE;

  // Confirming pushes the lapse date out, but only forwards: a report already
  // good for five hours must not be shortened by somebody agreeing with it.
  const extended = new Date(Date.now() + EXTENSION_MINUTES * 60 * 1_000);
  const expiresAt =
    !cleared && input.verdict === "still" && extended > report.expiresAt
      ? extended
      : report.expiresAt;

  await executor
    .update(trafficReports)
    .set({
      status: cleared ? "cleared" : "active",
      expiresAt,
      resolvedAt: cleared ? new Date() : null,
      resolvedByUserId: cleared ? viewer.userId : null,
    })
    // Guarded on the state we read: two people clearing the same report at once
    // must not both write the resolution.
    .where(
      and(
        eq(trafficReports.id, report.id),
        eq(trafficReports.status, "active"),
      ),
    );

  await recordAudit({
    actorUserId: viewer.userId,
    action: cleared ? "traffic.cleared" : "traffic.confirmed",
    subjectType: "traffic_report",
    subjectId: report.id,
    municipalityId: report.municipalityId,
    metadata: { verdict: input.verdict },
  });

  if (cleared) {
    // The map has to lose the cone as fast as it gained it.
    await publishRealtimeEvent({
      channel: TRAFFIC_CHANNEL,
      municipalityId: report.municipalityId,
      subjectType: "traffic_report",
      subjectId: report.id,
      action: "deleted",
      payload: { reason: "cleared" },
      location: report.location,
    });
  }

  return {
    status: cleared ? ("cleared" as const) : ("active" as const),
    stillCount: tally.stillCount,
    clearedCount: tally.clearedCount,
    expiresAt: expiresAt.toISOString(),
  };
}
