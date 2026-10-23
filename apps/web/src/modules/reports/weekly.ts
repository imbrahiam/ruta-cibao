import { ORPCError } from "@orpc/server";
import type { GenerateReportInput, WeeklyMetrics } from "@ruta/contracts";
import { weeklyMetrics } from "@ruta/contracts";
import { appTargetHref } from "@ruta/shared/app-target";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  categories,
  consultationResponses,
  consultations,
  memberProfiles,
  municipalities,
  places,
  weeklyReports,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { withIdempotency } from "@/lib/idempotency";
import { drainOutbox, enqueueJob } from "@/lib/jobs/outbox";
import { QUEUES } from "@/lib/jobs/queues";
import {
  assertModerates,
  type ModeratorViewer,
} from "@/modules/access/permissions";
import { notify } from "@/modules/notifications/notify";
import { renderWeeklyReportPdf } from "./render-pdf";

/**
 * What the platform did, one municipality at a time.
 *
 * The figures are computed once and stored, never recomputed on read. A weekly
 * report is a statement about a week that has ended: opening it in November has
 * to give the same numbers it gave in March, even though the rows behind it
 * have since been moderated, edited or deleted. A live query would quietly
 * rewrite history every time somebody looked at it.
 *
 * Everything is counted from the audit trail where the trail is the honest
 * source — "how many places were published this week" is a question about
 * decisions, and a place published on Tuesday and archived on Friday was still
 * published this week. Where the question is about a state rather than an event
 * ("how many cases are still open"), the table is read directly.
 */

/**
 * The province does not observe daylight saving, so its offset is fixed at
 * UTC-4 all year. That is what makes "Monday at midnight, local" expressible
 * without a timezone library, and what makes a week boundary mean the same
 * thing in March as in November.
 */
const UTC_OFFSET_HOURS = -4;

/** Monday 00:00 local, as an instant. */
export function weekStart(reference = new Date()): Date {
  const local = new Date(
    reference.getTime() + UTC_OFFSET_HOURS * 60 * 60 * 1_000,
  );
  // getUTCDay on the shifted instant is the local day of week. Sunday is 0, and
  // the week here starts on Monday, so Sunday is six days into it.
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;

  const midnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );

  return new Date(midnight - UTC_OFFSET_HOURS * 60 * 60 * 1_000);
}

export function previousWeekStart(reference = new Date()): Date {
  const current = weekStart(reference);
  return new Date(current.getTime() - 7 * 24 * 60 * 60 * 1_000);
}

function addWeek(start: Date): Date {
  return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1_000);
}

/** How many audit events of these kinds landed in the window. */
async function countActions(
  municipalityId: string,
  start: Date,
  end: Date,
  actions: string[],
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.municipalityId, municipalityId),
        inArray(auditEvents.action, actions),
        gte(auditEvents.createdAt, start),
        lt(auditEvents.createdAt, end),
      ),
    );

  return row?.total ?? 0;
}

async function medianFirstReplyHours(
  municipalityId: string,
  start: Date,
  end: Date,
): Promise<[{ medianHours: number | null } | undefined]> {
  const result = await db.execute<{ median_hours: number | null }>(sql`
    select percentile_cont(0.5) within group (order by hours) as median_hours
      from (
        select extract(epoch from (min(${consultationResponses.createdAt}) - ${consultations.createdAt})) / 3600.0 as hours
          from ${consultationResponses}
          join ${consultations}
            on ${consultations.id} = ${consultationResponses.consultationId}
         where ${consultations.municipalityId} = ${municipalityId}
         group by ${consultations.id}, ${consultations.createdAt}
        having min(${consultationResponses.createdAt}) >= ${start}
           and min(${consultationResponses.createdAt}) < ${end}
      ) first_replies
  `);

  const median = result.rows[0]?.median_hours;
  return [{ medianHours: median == null ? null : Number(median) }];
}

export async function computeMetrics(
  municipalityId: string,
  start: Date,
  end: Date,
): Promise<WeeklyMetrics> {
  const inWindow = and(
    gte(auditEvents.createdAt, start),
    lt(auditEvents.createdAt, end),
    eq(auditEvents.municipalityId, municipalityId),
  );

  const [
    placesSubmitted,
    placesPublished,
    placesRejected,
    trafficReported,
    trafficCleared,
    trafficExpired,
    trafficRemoved,
    consultationsOpened,
    businessesClaimed,
    businessesApproved,
    peopleVerified,
    routesSubmitted,
    routesPublished,
  ] = await Promise.all([
    countActions(municipalityId, start, end, ["place.submitted"]),
    countActions(municipalityId, start, end, ["place.published"]),
    countActions(municipalityId, start, end, ["place.rejected"]),
    countActions(municipalityId, start, end, ["traffic.reported"]),
    countActions(municipalityId, start, end, ["traffic.cleared"]),
    countActions(municipalityId, start, end, ["traffic.expired"]),
    countActions(municipalityId, start, end, ["traffic.removed"]),
    countActions(municipalityId, start, end, ["consultation.opened"]),
    countActions(municipalityId, start, end, ["business_claim.submitted"]),
    countActions(municipalityId, start, end, ["business_claim.approved"]),
    countActions(municipalityId, start, end, [
      "member.cedula_verified",
      "member.residency_verified",
    ]),
    countActions(municipalityId, start, end, ["route.submitted"]),
    countActions(municipalityId, start, end, ["route.published"]),
  ]);

  const [
    [placesTotal],
    [caseCounts],
    [responseTimes],
    [contributors],
    topCategories,
  ] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(places)
      .where(
        and(
          eq(places.municipalityId, municipalityId),
          eq(places.status, "published"),
          lt(places.createdAt, end),
        ),
      ),

    db
      .select({
        answered: sql<number>`count(*) filter (
          where ${consultations.answeredAt} >= ${start}
            and ${consultations.answeredAt} < ${end}
        )::int`,
        resolved: sql<number>`count(*) filter (
          where ${consultations.status} = 'resolved'
            and ${consultations.closedAt} >= ${start}
            and ${consultations.closedAt} < ${end}
        )::int`,
        // A state, not an event: what was still waiting when the week ended.
        stillOpen: sql<number>`count(*) filter (
          where ${consultations.status} in ('open', 'in_review')
            and ${consultations.createdAt} < ${end}
        )::int`,
      })
      .from(consultations)
      .where(eq(consultations.municipalityId, municipalityId)),

    // Median rather than mean: one case that sat for three months would drag
    // an average past the point of describing anything, and this number is
    // there to answer "how long does the ayuntamiento usually take".
    //
    // The first reply is found with `min(created_at)` rather than by matching
    // the case's `answeredAt`. Those two timestamps come from different clocks
    // — one from the application, one from the database default — so comparing
    // them for equality would silently match nothing.
    medianFirstReplyHours(municipalityId, start, end),

    db
      .select({
        total: sql<number>`count(distinct ${auditEvents.actorUserId})::int`,
      })
      .from(auditEvents)
      .where(
        and(
          inWindow,
          sql`${auditEvents.actorUserId} is not null`,
          inArray(auditEvents.action, [
            "place.submitted",
            "place.reported",
            "place.confirmed",
            "traffic.reported",
            "traffic.confirmed",
            "consultation.opened",
            "consultation.supported",
            "business_claim.submitted",
          ]),
        ),
      ),

    db
      .select({
        name: categories.name,
        count: sql<number>`count(*)::int`,
      })
      .from(places)
      .innerJoin(categories, eq(categories.id, places.categoryId))
      .where(
        and(
          eq(places.municipalityId, municipalityId),
          eq(places.status, "published"),
          gte(places.createdAt, start),
          lt(places.createdAt, end),
        ),
      )
      .groupBy(categories.name)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
  ]);

  return weeklyMetrics.parse({
    places: {
      submitted: placesSubmitted,
      published: placesPublished,
      rejected: placesRejected,
      total: placesTotal?.total ?? 0,
    },
    traffic: {
      reported: trafficReported,
      cleared: trafficCleared,
      expired: trafficExpired,
      removed: trafficRemoved,
    },
    consultations: {
      opened: consultationsOpened,
      answered: caseCounts?.answered ?? 0,
      resolved: caseCounts?.resolved ?? 0,
      stillOpen: caseCounts?.stillOpen ?? 0,
      medianResponseHours:
        responseTimes?.medianHours == null
          ? null
          : Math.round(Number(responseTimes.medianHours) * 10) / 10,
    },
    businesses: {
      claimed: businessesClaimed,
      approved: businessesApproved,
    },
    routes: { submitted: routesSubmitted, published: routesPublished },
    people: {
      verified: peopleVerified,
      contributors: contributors?.total ?? 0,
    },
    topCategories,
  });
}

/**
 * Builds — or rebuilds — one municipality's report for one week.
 *
 * Idempotent, which is not optional: the schedule can fire twice after a worker
 * restart, and a failed job is retried. The row is claimed with an upsert on
 * `(municipality, period)`, so a second run overwrites the same row rather than
 * producing a second report, and the notification only goes out on the run that
 * moved it from `pending` to `ready`.
 */
export async function buildWeeklyReport(
  municipalityId: string,
  start: Date,
): Promise<{ id: string; alreadyReady: boolean }> {
  const end = addWeek(start);

  const [claimed] = await db
    .insert(weeklyReports)
    .values({
      municipalityId,
      periodStart: start,
      periodEnd: end,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: [weeklyReports.municipalityId, weeklyReports.periodStart],
      // Touch nothing but the period end, so the existing row is returned with
      // its real status: that is how the caller knows not to notify twice.
      set: { periodEnd: end },
    })
    .returning({ id: weeklyReports.id, status: weeklyReports.status });

  if (!claimed) throw new Error("Weekly report upsert returned no row.");
  if (claimed.status === "ready") {
    return { id: claimed.id, alreadyReady: true };
  }

  try {
    const metrics = await computeMetrics(municipalityId, start, end);

    await db
      .update(weeklyReports)
      .set({
        status: "ready",
        metrics,
        generatedAt: new Date(),
        failureReason: null,
      })
      .where(eq(weeklyReports.id, claimed.id));
  } catch (error) {
    // The reason is stored for the desk to show, never the stack: a report
    // page is read by an official, and a trace tells them nothing they can act
    // on. The throw is kept so the queue retries.
    await db
      .update(weeklyReports)
      .set({ status: "failed", failureReason: "metrics_failed" })
      .where(eq(weeklyReports.id, claimed.id));

    throw error;
  }

  await recordAudit({
    actorUserId: null,
    action: "report.generated",
    subjectType: "weekly_report",
    subjectId: claimed.id,
    municipalityId,
    metadata: { periodStart: start.toISOString() },
  });

  return { id: claimed.id, alreadyReady: false };
}

/**
 * Last week, for every municipality, and a note to whoever has to read it.
 *
 * The notification goes to the officials scoped to that municipality plus every
 * province administrator. Nobody else is told: a weekly report is a working
 * document for the ayuntamiento, and pushing it at every resident would be the
 * fastest way to make people turn notifications off.
 */
export async function buildWeeklyReports(
  reference = new Date(),
  explicitStart?: Date,
  municipalityId?: string,
): Promise<{ built: number; notified: number }> {
  const start = explicitStart ?? previousWeekStart(reference);
  if (
    start.getTime() !== weekStart(start).getTime() ||
    addWeek(start) > reference
  )
    throw new Error("Report period must be a completed local week");

  const targets = await db
    .select({ id: municipalities.id, name: municipalities.name })
    .from(municipalities)
    .where(municipalityId ? eq(municipalities.id, municipalityId) : undefined)
    .orderBy(asc(municipalities.id));

  const staff = await db
    .select({
      userId: memberProfiles.userId,
      staffMunicipalityId: memberProfiles.staffMunicipalityId,
      staffRole: memberProfiles.staffRole,
    })
    .from(memberProfiles)
    .where(inArray(memberProfiles.staffRole, ["moderator", "admin"]));

  let built = 0;
  let notified = 0;
  const failures: unknown[] = [];

  for (const municipality of targets) {
    try {
      const report = await buildWeeklyReport(municipality.id, start);
      built += 1;

      // Retries also repair reports whose metrics committed before a PDF failure.
      await renderWeeklyReportPdf(report.id);

      for (const person of staff) {
        const reads =
          person.staffRole === "admin" ||
          person.staffMunicipalityId === municipality.id;
        if (!reads) continue;

        await notify({
          userId: person.userId,
          dedupeKey: `weekly-report:${report.id}:${person.userId}`,
          messageKey: "notifications.reportReady",
          params: { scope: municipality.name },
          href: appTargetHref({ kind: "report", ref: report.id }),
          channels: { push: true, email: true },
        });

        notified += 1;
      }
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw failures[0];
  }

  return { built, notified };
}

export async function generateWeeklyReportForMunicipality(
  viewer: ModeratorViewer,
  input: GenerateReportInput,
): Promise<{ reportId: string; status: "pending" | "ready" | "failed" }> {
  assertModerates(viewer, input.municipalityId);
  const start = previousWeekStart();
  const end = addWeek(start);

  const outcome = await withIdempotency({
    key: `reports:generate:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [municipality] = await tx
        .select({ id: municipalities.id })
        .from(municipalities)
        .where(eq(municipalities.id, input.municipalityId))
        .limit(1);
      if (!municipality) {
        throw new ORPCError("NOT_FOUND", {
          message: "That municipality does not exist.",
          data: { reason: "municipality_not_found" },
        });
      }

      const [row] = await tx
        .insert(weeklyReports)
        .values({
          municipalityId: municipality.id,
          periodStart: start,
          periodEnd: end,
          status: "pending",
        })
        .onConflictDoUpdate({
          target: [weeklyReports.municipalityId, weeklyReports.periodStart],
          set: {
            periodEnd: end,
            status: sql`case when ${weeklyReports.status} = 'failed' then 'pending'::weekly_report_status else ${weeklyReports.status} end`,
          },
        })
        .returning({ id: weeklyReports.id, status: weeklyReports.status });

      if (!row) throw new Error("Weekly report upsert returned no row.");

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "report.generate_requested",
          subjectType: "weekly_report",
          subjectId: row.id,
          municipalityId: municipality.id,
          metadata: { periodStart: start.toISOString() },
        },
        tx,
      );

      await enqueueJob(tx, QUEUES.reportsWeekly, {
        municipalityId: municipality.id,
        periodStart: start.toISOString(),
      });

      return { reportId: row.id, status: row.status };
    },
  });

  if (!outcome.replayed && !env.JOBS_ENABLED) {
    await drainOutbox().catch(() => {
      console.error(
        "inline weekly report generation failed; outbox retains it",
      );
    });
    const [latest] = await db
      .select({ status: weeklyReports.status })
      .from(weeklyReports)
      .where(eq(weeklyReports.id, outcome.result.reportId))
      .limit(1);
    if (latest) {
      return { reportId: outcome.result.reportId, status: latest.status };
    }
  }

  return outcome.result;
}
