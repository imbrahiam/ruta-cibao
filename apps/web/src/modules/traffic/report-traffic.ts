import type { ReportTrafficInput } from "@ruta/contracts";
import { isSubmittable } from "@ruta/shared/geo";
import { nearestOnPath } from "@ruta/shared/road-geometry";
import { and, eq, sql } from "drizzle-orm";
import {
  categories,
  municipalities,
  TRAFFIC_REPORT_TTL_MINUTES,
  trafficReports,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { enqueueJob } from "@/lib/jobs/outbox";
import { QUEUES } from "@/lib/jobs/queues";
import { streetAt } from "@/lib/map/roads";
import { consumeRateLimit } from "@/lib/rate-limit";
import { publishRealtimeEvent } from "@/lib/realtime";
import type { MemberViewer } from "@/modules/access/viewer";

/**
 * Filing a report about the road.
 *
 * The one thing this must not do is make somebody wait. A report has a useful
 * life measured in hours, so it publishes immediately rather than joining a
 * moderation queue — and everything that would otherwise have justified the
 * queue is handled another way: the map shows who filed it, neighbours can
 * contradict it, it lapses on its own, and a moderator can take it down after
 * the fact.
 */
export const TRAFFIC_CHANNEL = "traffic";

/**
 * Enough to stop a bored person filling a municipality with holes, loose enough
 * that somebody driving through a genuinely bad afternoon is not cut off.
 */
const REPORT_POLICY = {
  scope: "traffic-report",
  limit: 6,
  windowMs: 60 * 60 * 1_000,
};

export class TrafficError extends Error {
  constructor(
    readonly reason:
      | "invalid_category"
      | "invalid_street"
      | "outside_province"
      | "duplicate"
      | "not_found"
      | "own_report"
      | "already_resolved"
      | "rate_limited"
      | "stale_report",
    /** For `duplicate`: the active report this one would repeat. */
    readonly existingReportId?: string,
  ) {
    super(reason);
    this.name = "TrafficError";
  }
}

export async function reportTraffic(
  viewer: MemberViewer,
  input: ReportTrafficInput,
) {
  if (!isSubmittable(input.location))
    throw new TrafficError("outside_province");
  // Resolve the confirmed way and extent from trusted OSM geometry. A missing
  // way must be reselected explicitly, never silently turned into a point.
  const street =
    input.shape === "street"
      ? ((
          await streetAt({
            ...input.location,
            roadId: input.roadId,
            extentMeters: input.extentMeters,
          })
        ).street ?? null)
      : null;

  // Where the marker goes. Snapped onto the road when there is one, so the pin
  // sits on the street the report is about rather than in the yard beside it.
  const location =
    (street && nearestOnPath(street.path, input.location)?.point) ??
    input.location;

  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const age = Date.now() - new Date(input.observedAt).getTime();
      if (age > TRAFFIC_REPORT_TTL_MINUTES * 60000 || age < -60000)
        throw new TrafficError("stale_report");
      const allowance = await consumeRateLimit(viewer.userId, REPORT_POLICY);
      if (!allowance.allowed) throw new TrafficError("rate_limited");
      // A transaction owns one connection, so these run in sequence: parallel
      // queries on it are deprecated by pg and would not overlap anyway.
      const [category] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.id, input.categoryId),
            eq(categories.isActive, true),
            eq(categories.kind, "traffic"),
          ),
        )
        .limit(1);

      // Which municipality this is, asked of the geometry rather than of the
      // person filing it.
      const [municipality] = await tx
        .select({ id: municipalities.id })
        .from(municipalities)
        .where(
          sql`ST_Contains(${municipalities.boundary}, ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326))`,
        )
        .limit(1);

      if (!category) throw new TrafficError("invalid_category");
      if (!municipality) throw new TrafficError("outside_province");
      if (input.shape === "street" && !street)
        throw new TrafficError("invalid_street");

      // Three people stuck behind the same landslide will all report it, which
      // is a good sign about the platform and a bad one for the map. A second
      // report of the same category within 150 m of an active one is refused
      // with that report's id; it is not counted as a confirmation, so the
      // client offers to open the existing one and confirm it explicitly.
      const [nearby] = await tx
        .select({ id: trafficReports.id })
        .from(trafficReports)
        .where(
          and(
            eq(trafficReports.categoryId, input.categoryId),
            eq(trafficReports.status, "active"),
            sql`${trafficReports.expiresAt} > now()`,
            sql`ST_DWithin(${trafficReports.location}::geography, ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)::geography, 150)`,
          ),
        )
        .limit(1);

      if (nearby) throw new TrafficError("duplicate", nearby.id);

      const expiresAt = new Date(
        new Date(input.observedAt).getTime() +
          TRAFFIC_REPORT_TTL_MINUTES * 60 * 1_000,
      );

      const [created] = await tx
        .insert(trafficReports)
        .values({
          categoryId: input.categoryId,
          municipalityId: municipality.id,
          location: { x: location.lng, y: location.lat },
          path:
            street?.path.map((point) => ({ x: point.lng, y: point.lat })) ??
            null,
          description: input.description || null,
          // The category, place and freshness warn people at once; the free
          // text is held for review. Nothing to review when there is none.
          descriptionModerationStatus: input.description
            ? "pending"
            : "published",
          reportedByUserId: viewer.userId,
          expiresAt,
        })
        .returning({ id: trafficReports.id });

      if (!created) throw new Error("Traffic report insert returned no row.");

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "traffic.reported",
          subjectType: "traffic_report",
          subjectId: created.id,
          municipalityId: municipality.id,
          metadata: {
            categoryId: input.categoryId,
            // Worth recording: a report asked for as a street that came back a
            // point means the lookup found nothing, and a moderator looking at
            // an odd report should be able to see that is why.
            requestedShape: input.shape,
            shape: street ? "street" : "point",
            street: street?.name ?? null,
            roadId: street?.roadId ?? null,
            extentMeters: street?.lengthMeters ?? null,
          },
        },
        tx,
      );

      await publishRealtimeEvent(
        {
          channel: TRAFFIC_CHANNEL,
          municipalityId: municipality.id,
          subjectType: "traffic_report",
          subjectId: created.id,
          action: "created",
          payload: { categoryId: input.categoryId },
          location: { x: location.lng, y: location.lat },
        },
        tx,
      );
      await enqueueJob(tx, QUEUES.trafficNotifyNearby, {
        reportId: created.id,
      });

      return {
        id: created.id,
        municipalityId: municipality.id,
        expiresAt: expiresAt.toISOString(),
        location,
      };
    },
  });

  return {
    id: outcome.result.id,
    status: "active" as const,
    expiresAt: new Date(outcome.result.expiresAt).toISOString(),
  };
}
