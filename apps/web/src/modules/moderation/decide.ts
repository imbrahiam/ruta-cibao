import type {
  DecideClaimInput,
  DecidePhotoInput,
  DecidePlaceInput,
  DecideReportInput,
  RemoveTrafficInput,
} from "@ruta/contracts";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { PLACES_GEOJSON_TAG } from "@/app/api/places/geojson/route";
import { PLACES_TILES_TAG } from "@/app/api/tiles/places/[z]/[x]/[y]/route";
import {
  businessClaims,
  categories,
  placePhotos,
  placeReports,
  places,
  trafficReports,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { publishRealtimeEvent } from "@/lib/realtime";
import {
  assertModerates,
  type ModeratorViewer,
} from "@/modules/access/permissions";
import { notify } from "@/modules/notifications/notify";
import { TRAFFIC_CHANNEL } from "@/modules/traffic/report-traffic";

/**
 * Acting on somebody else's contribution.
 *
 * Four things happen on every decision and none of them is optional: the row
 * moves, the trail records who moved it, the person who submitted it is told,
 * and the map's cache is dropped so the answer is visible immediately rather
 * than up to an hour later.
 *
 * The decision itself is idempotent — a moderator on a phone that lost signal
 * mid-tap retries, and the second attempt must not publish twice or send a
 * second notification.
 */
export class ModerationError extends Error {
  constructor(readonly reason: "not_found" | "already_decided") {
    super(reason);
    this.name = "ModerationError";
  }
}

export async function decidePlace(
  viewer: ModeratorViewer,
  input: DecidePlaceInput,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [place] = await tx
        .select({
          id: places.id,
          slug: places.slug,
          name: places.name,
          status: places.status,
          municipalityId: places.municipalityId,
          createdByUserId: places.createdByUserId,
        })
        .from(places)
        .where(eq(places.id, input.placeId))
        .limit(1)
        .for("update");

      if (!place) throw new ModerationError("not_found");
      // The scope check happens after the row is read, because the row is what
      // says which municipality this is.
      assertModerates(viewer, place.municipalityId);
      if (place.status !== "pending") {
        throw new ModerationError("already_decided");
      }

      const published = input.decision === "publish";

      await tx
        .update(places)
        .set({
          status: published ? "published" : "rejected",
          reviewedByUserId: viewer.userId,
          reviewNote: input.note || null,
          publishedAt: published ? new Date() : null,
        })
        .where(eq(places.id, place.id));

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: published ? "place.published" : "place.rejected",
          subjectType: "place",
          subjectId: place.id,
          municipalityId: place.municipalityId,
          metadata: { decision: input.decision },
        },
        tx,
      );

      if (place.createdByUserId) {
        await notify(
          {
            userId: place.createdByUserId,
            messageKey: published
              ? "notifications.placeApproved"
              : "notifications.placeRejected",
            params: { name: place.name },
            href: published ? `/mapa?lugar=${place.slug}` : "/aportes",
          },
          tx,
        );
      }
      await publishRealtimeEvent(
        {
          channel: "places",
          municipalityId: place.municipalityId,
          subjectType: "place",
          subjectId: place.id,
          action: published ? "created" : "deleted",
        },
        tx,
      );
      return { place, published };
    },
  });

  // Replays skip the side effects: the first attempt already sent them.
  if (outcome.replayed) return { status: "ok" as const };

  const { published } = outcome.result;

  if (published) {
    // `{ expire: 0 }` rather than a stale-while-revalidate window: a citizen
    // who was told their place is on the map has to find it there when they
    // look, which is immediately.
    revalidateTag(PLACES_GEOJSON_TAG, { expire: 0 });
    revalidateTag(PLACES_TILES_TAG, { expire: 0 });
  }

  return { status: "ok" as const };
}

export async function decideReport(
  viewer: ModeratorViewer,
  input: DecideReportInput,
) {
  await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [row] = await tx
        .select({
          id: placeReports.id,
          status: placeReports.status,
          municipalityId: places.municipalityId,
          placeId: places.id,
        })
        .from(placeReports)
        .innerJoin(places, eq(places.id, placeReports.placeId))
        .where(eq(placeReports.id, input.reportId))
        .limit(1)
        .for("update");

      if (!row) throw new ModerationError("not_found");
      assertModerates(viewer, row.municipalityId);
      if (row.status !== "pending") {
        throw new ModerationError("already_decided");
      }

      await tx
        .update(placeReports)
        .set({ status: input.decision })
        .where(
          and(eq(placeReports.id, row.id), eq(placeReports.status, "pending")),
        );

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: `place_report.${input.decision}`,
          subjectType: "place_report",
          subjectId: row.id,
          municipalityId: row.municipalityId,
          metadata: { placeId: row.placeId, note: input.note ?? null },
        },
        tx,
      );

      return { ok: true as const };
    },
  });

  return { status: "ok" as const };
}

/**
 * Publishing or refusing a photograph.
 *
 * A refused photo keeps its row and its object rather than being deleted: the
 * audit trail has to be able to say what was rejected, and a moderator who
 * mis-taps needs something to point at. Cleaning storage is a separate,
 * deliberate job — not a side effect of a tap.
 */
export async function decidePhoto(
  viewer: ModeratorViewer,
  input: DecidePhotoInput,
) {
  await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [row] = await tx
        .select({
          id: placePhotos.id,
          status: placePhotos.status,
          placeId: places.id,
          municipalityId: places.municipalityId,
        })
        .from(placePhotos)
        .innerJoin(places, eq(places.id, placePhotos.placeId))
        .where(eq(placePhotos.id, input.photoId))
        .limit(1)
        .for("update");

      if (!row) throw new ModerationError("not_found");
      assertModerates(viewer, row.municipalityId);
      if (row.status !== "pending") {
        throw new ModerationError("already_decided");
      }

      const published = input.decision === "publish";

      await tx
        .update(placePhotos)
        .set({
          status: published ? "published" : "rejected",
          reviewedByUserId: viewer.userId,
        })
        .where(eq(placePhotos.id, row.id));

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: published ? "place_photo.published" : "place_photo.rejected",
          subjectType: "place_photo",
          subjectId: row.id,
          municipalityId: row.municipalityId,
          metadata: { placeId: row.placeId },
        },
        tx,
      );

      return { published };
    },
  });

  return { status: "ok" as const };
}

/**
 * Approving or refusing a claim on a business.
 *
 * Approval is the moment the platform starts vouching for a phone number, so it
 * follows the same four steps as every other decision — the row moves, the
 * trail records who moved it, the claimant is told, and the map's cache is
 * dropped so the contact details appear immediately rather than an hour later.
 *
 * The unique partial index on `place_id where status = 'approved'` is what
 * makes two moderators approving two rival claims impossible. It fires as a
 * constraint violation inside the transaction, which rolls the whole decision
 * back — which is the right outcome, and better than a check that races.
 */
export async function decideBusinessClaim(
  viewer: ModeratorViewer,
  input: DecideClaimInput,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [row] = await tx
        .select({
          id: businessClaims.id,
          status: businessClaims.status,
          claimantUserId: businessClaims.claimantUserId,
          placeId: places.id,
          placeName: places.name,
          placeSlug: places.slug,
          municipalityId: places.municipalityId,
        })
        .from(businessClaims)
        .innerJoin(places, eq(places.id, businessClaims.placeId))
        .where(eq(businessClaims.id, input.claimId))
        .limit(1)
        .for("update");

      if (!row) throw new ModerationError("not_found");
      assertModerates(viewer, row.municipalityId);
      if (row.status !== "pending") {
        throw new ModerationError("already_decided");
      }

      const approved = input.decision === "approve";

      await tx
        .update(businessClaims)
        .set({
          status: approved ? "approved" : "rejected",
          reviewedByUserId: viewer.userId,
          reviewNote: input.note || null,
          decidedAt: new Date(),
        })
        .where(
          and(
            eq(businessClaims.id, row.id),
            eq(businessClaims.status, "pending"),
          ),
        );

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: approved
            ? "business_claim.approved"
            : "business_claim.rejected",
          subjectType: "business_claim",
          subjectId: row.id,
          municipalityId: row.municipalityId,
          metadata: { placeId: row.placeId },
        },
        tx,
      );

      await notify(
        {
          userId: row.claimantUserId,
          messageKey: approved
            ? "notifications.businessClaimApproved"
            : "notifications.businessClaimRejected",
          params: { name: row.placeName },
          href: approved ? `/mapa?lugar=${row.placeSlug}` : "/aportes",
          // Push and the notification centre, like every other moderation decision.
          // No email: `notify` sends one only when handed an address, and a claim
          // decision does not warrant reaching outside the platform for it.
          channels: { push: true, email: false },
        },
        tx,
      );
      await publishRealtimeEvent(
        {
          channel: "places",
          municipalityId: row.municipalityId,
          subjectType: "place",
          subjectId: row.placeId,
          action: "updated",
        },
        tx,
      );
      return { row, approved };
    },
  });

  if (outcome.replayed) return { status: "ok" as const };

  const { approved } = outcome.result;

  if (approved) {
    // The contact details are part of what the tiles and the directory serve,
    // so the map has to lose its cached copy the moment they become public.
    revalidateTag(PLACES_GEOJSON_TAG, { expire: 0 });
    revalidateTag(PLACES_TILES_TAG, { expire: 0 });
  }

  return { status: "ok" as const };
}

/**
 * Taking a traffic report off the map.
 *
 * The one moderation action here that is a correction rather than a gate:
 * traffic publishes without review, so this is what happens when a report turns
 * out to be wrong, malicious, or somebody's idea of a joke. The note is
 * mandatory — the reporter is told, and "no" without a reason from an
 * institution is how people stop reporting.
 *
 * The row is kept, marked `removed`. A deleted row cannot be pointed at when
 * somebody asks why their report vanished.
 */
export async function removeTrafficReport(
  viewer: ModeratorViewer,
  input: RemoveTrafficInput,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [report] = await tx
        .select({
          id: trafficReports.id,
          status: trafficReports.status,
          municipalityId: trafficReports.municipalityId,
          reportedByUserId: trafficReports.reportedByUserId,
          location: trafficReports.location,
          categoryName: categories.name,
        })
        .from(trafficReports)
        .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
        .where(eq(trafficReports.id, input.reportId))
        .limit(1)
        .for("update");

      if (!report) throw new ModerationError("not_found");
      assertModerates(viewer, report.municipalityId);
      if (report.status !== "active") {
        throw new ModerationError("already_decided");
      }

      await tx
        .update(trafficReports)
        .set({
          status: "removed",
          resolvedByUserId: viewer.userId,
          resolvedAt: new Date(),
          reviewNote: input.note,
        })
        .where(
          and(
            eq(trafficReports.id, report.id),
            eq(trafficReports.status, "active"),
          ),
        );

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "traffic.removed",
          subjectType: "traffic_report",
          subjectId: report.id,
          municipalityId: report.municipalityId,
        },
        tx,
      );

      await publishRealtimeEvent(
        {
          channel: TRAFFIC_CHANNEL,
          municipalityId: report.municipalityId,
          subjectType: "traffic_report",
          subjectId: report.id,
          action: "deleted",
          payload: { reason: "removed" },
          location: report.location,
        },
        tx,
      );

      if (report.reportedByUserId) {
        await notify(
          {
            userId: report.reportedByUserId,
            messageKey: "notifications.trafficRemoved",
            params: { description: report.categoryName },
            href: "/aportes",
            channels: { push: false, email: false },
          },
          tx,
        );
      }

      return report;
    },
  });

  if (outcome.replayed) return { status: "ok" as const };

  return { status: "ok" as const };
}
