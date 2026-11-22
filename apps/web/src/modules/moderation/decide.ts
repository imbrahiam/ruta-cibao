import type {
  DecideClaimInput,
  DecideContentReportInput,
  DecidePhotoInput,
  DecidePlaceInput,
  DecidePublicationInput,
  DecideReportInput,
  RemoveTrafficInput,
} from "@ruta/contracts";
import { appTargetHref } from "@ruta/shared/app-target";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { PLACES_GEOJSON_TAG } from "@/app/api/places/geojson/route";
import { PLACES_TILES_TAG } from "@/app/api/tiles/places/[z]/[x]/[y]/route";
import {
  businessClaims,
  categories,
  comments,
  consultations,
  contentReports,
  ecoRoutes,
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
import { CONSULTATIONS_CHANNEL } from "@/modules/consultations/open-consultation";
import { notify } from "@/modules/notifications/notify";
import {
  revokeOfflineSnapshots,
  scheduleOfflineSnapshotRebuild,
} from "@/modules/offline/snapshot";
import { resolveContentTarget } from "@/modules/safety/targets";
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
function revalidatePlaceCaches() {
  try {
    revalidateTag(PLACES_GEOJSON_TAG, { expire: 0 });
    revalidateTag(PLACES_TILES_TAG, { expire: 0 });
  } catch {
    // expected: there is no Next.js request context (CLI script or test).
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
            href: published
              ? appTargetHref({ kind: "place", ref: place.slug })
              : appTargetHref({ kind: "contributions" }),
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
      if (published) await scheduleOfflineSnapshotRebuild(tx);
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
    revalidatePlaceCaches();
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

      if (published) await scheduleOfflineSnapshotRebuild(tx);
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
          href: approved
            ? appTargetHref({ kind: "place", ref: row.placeSlug })
            : appTargetHref({ kind: "contributions" }),
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
      if (approved) await scheduleOfflineSnapshotRebuild(tx);
      return { row, approved };
    },
  });

  if (outcome.replayed) return { status: "ok" as const };

  const { approved } = outcome.result;

  if (approved) {
    // The contact details are part of what the tiles and the directory serve,
    // so the map has to lose its cached copy the moment they become public.
    revalidatePlaceCaches();
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
            href: appTargetHref({ kind: "contributions" }),
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

/**
 * Acting on a report about content.
 *
 * `actioned` takes the content out of everybody's view, not just the
 * reporter's: a place is archived, a photo or route rejected, a traffic report
 * removed and a case hidden. Content that is already out of view is left as it
 * is. Every open report about the same content is closed with the same
 * decision, because the decision is about the content, and the author of
 * removed content is told which item it was (never who reported it).
 */
export async function decideContentReport(
  viewer: ModeratorViewer,
  input: DecideContentReportInput,
) {
  const outcome = await withIdempotency({
    key: `moderation:content-report:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [report] = await tx
        .select()
        .from(contentReports)
        .where(eq(contentReports.id, input.reportId))
        .limit(1)
        .for("update");

      if (!report) throw new ModerationError("not_found");
      assertModerates(viewer, report.municipalityId);
      if (report.status !== "open")
        throw new ModerationError("already_decided");

      const decidedAt = new Date();
      const closed = await tx
        .update(contentReports)
        .set({
          status: input.decision,
          decisionReason: input.reason,
          reviewedByUserId: viewer.userId,
          reviewedAt: decidedAt,
        })
        .where(
          and(
            eq(contentReports.subjectKind, report.subjectKind),
            eq(contentReports.subjectRef, report.subjectRef),
            eq(contentReports.status, "open"),
          ),
        )
        .returning({ id: contentReports.id });

      let removed = false;
      let revalidatePlaces = false;
      const subject = await resolveContentTarget(tx, {
        kind: report.subjectKind,
        ref: report.subjectRef,
      });

      if (input.decision === "actioned" && subject?.publiclyVisible) {
        removed = true;
        switch (subject.kind) {
          case "place":
            await tx
              .update(places)
              .set({ status: "archived", reviewedByUserId: viewer.userId })
              .where(
                and(
                  eq(places.slug, subject.ref),
                  eq(places.status, "published"),
                ),
              );
            revalidatePlaces = true;
            await publishRealtimeEvent(
              {
                channel: "places",
                municipalityId: subject.municipalityId,
                subjectType: "place",
                subjectId: subject.ref,
                action: "deleted",
              },
              tx,
            );
            await revokeOfflineSnapshots("content_report_actioned", tx);
            await scheduleOfflineSnapshotRebuild(tx);
            break;
          case "photo":
            await tx
              .update(placePhotos)
              .set({ status: "rejected", reviewedByUserId: viewer.userId })
              .where(
                and(
                  eq(placePhotos.id, subject.ref),
                  eq(placePhotos.status, "published"),
                ),
              );
            await revokeOfflineSnapshots("content_report_actioned", tx);
            await scheduleOfflineSnapshotRebuild(tx);
            break;
          case "route":
            await tx
              .update(ecoRoutes)
              .set({
                status: "rejected",
                reviewNote: input.reason,
                reviewedAt: decidedAt,
              })
              .where(
                and(
                  eq(ecoRoutes.id, subject.ref),
                  eq(ecoRoutes.status, "published"),
                ),
              );
            await publishRealtimeEvent(
              {
                channel: "routes",
                municipalityId: subject.municipalityId,
                subjectType: "route",
                subjectId: subject.ref,
                action: "deleted",
              },
              tx,
            );
            await revokeOfflineSnapshots("content_report_actioned", tx);
            await scheduleOfflineSnapshotRebuild(tx);
            break;
          case "traffic": {
            const [reportRow] = await tx
              .update(trafficReports)
              .set({
                status: "removed",
                resolvedByUserId: viewer.userId,
                resolvedAt: decidedAt,
                reviewNote: input.reason,
              })
              .where(
                and(
                  eq(trafficReports.id, subject.ref),
                  eq(trafficReports.status, "active"),
                ),
              )
              .returning({ location: trafficReports.location });
            if (reportRow) {
              await publishRealtimeEvent(
                {
                  channel: TRAFFIC_CHANNEL,
                  municipalityId: subject.municipalityId,
                  subjectType: "traffic_report",
                  subjectId: subject.ref,
                  action: "deleted",
                  payload: { reason: "removed" },
                  location: reportRow.location,
                },
                tx,
              );
            }
            break;
          }
          case "comment":
            await tx
              .update(comments)
              .set({ status: "hidden", updatedAt: decidedAt })
              .where(eq(comments.id, subject.ref));
            break;
          case "consultation":
            await tx
              .update(consultations)
              .set({ publicationStatus: "hidden" })
              .where(eq(consultations.slug, subject.ref));
            await publishRealtimeEvent(
              {
                channel: CONSULTATIONS_CHANNEL,
                municipalityId: subject.municipalityId,
                subjectType: "consultation",
                subjectId: subject.ref,
                action: "deleted",
              },
              tx,
            );
            break;
        }

        if (subject.authorUserId) {
          await notify(
            {
              userId: subject.authorUserId,
              messageKey: "notifications.contentRemoved",
              params: { title: subject.title },
              href: appTargetHref({ kind: "contributions" }),
              dedupeKey: `content-report:${report.id}:removed`,
              channels: { push: true, email: false },
            },
            tx,
          );
        }
      }

      // The reason stays in the report row; the trail records the outcome.
      for (const row of closed) {
        await recordAudit(
          {
            actorUserId: viewer.userId,
            action: `content_report.${input.decision}`,
            subjectType: "content_report",
            subjectId: row.id,
            municipalityId: report.municipalityId,
            metadata: {
              kind: report.subjectKind,
              contentRemoved: removed,
            },
          },
          tx,
        );
      }

      return { revalidatePlaces };
    },
  });

  if (!outcome.replayed && outcome.result.revalidatePlaces) {
    revalidatePlaceCaches();
  }

  return { status: input.decision };
}

/**
 * Publishing or hiding what is held back from other people: a whole case, or
 * the free text of a traffic report (its category and place are never held).
 *
 * Idempotent on the end state, so a retried tap never notifies twice.
 */
export async function decidePublication(
  viewer: ModeratorViewer,
  input: DecidePublicationInput,
) {
  await withIdempotency({
    key: `moderation:publication:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      if (input.target.kind === "consultation") {
        const [row] = await tx
          .select({
            id: consultations.id,
            slug: consultations.slug,
            title: consultations.title,
            municipalityId: consultations.municipalityId,
            authorUserId: consultations.openedByUserId,
            publicationStatus: consultations.publicationStatus,
          })
          .from(consultations)
          .where(eq(consultations.id, input.target.ref))
          .limit(1)
          .for("update");
        if (!row) throw new ModerationError("not_found");
        assertModerates(viewer, row.municipalityId);
        if (row.publicationStatus === input.status) return { unchanged: true };

        await tx
          .update(consultations)
          .set({
            publicationStatus: input.status,
            // The contract requires a reason to hide: the author is told why.
            reviewNote:
              input.status === "hidden" ? (input.reason ?? null) : null,
          })
          .where(eq(consultations.id, row.id));
        await recordAudit(
          {
            actorUserId: viewer.userId,
            action: `consultation.${input.status === "published" ? "published" : "hidden"}`,
            subjectType: "consultation",
            subjectId: row.id,
            municipalityId: row.municipalityId,
            metadata: {
              from: row.publicationStatus,
              reason: input.reason ?? null,
            },
          },
          tx,
        );
        await publishRealtimeEvent(
          {
            channel: CONSULTATIONS_CHANNEL,
            municipalityId: row.municipalityId,
            subjectType: "consultation",
            subjectId: row.id,
            action: input.status === "published" ? "created" : "deleted",
          },
          tx,
        );
        if (row.authorUserId) {
          await notify(
            {
              userId: row.authorUserId,
              messageKey:
                input.status === "published"
                  ? "notifications.consultationPublished"
                  : "notifications.consultationHidden",
              params: { title: row.title },
              href: appTargetHref({ kind: "consultation", ref: row.slug }),
              dedupeKey: `consultation:${row.id}:publication:${input.status}:${input.requestId}`,
              channels: { push: true, email: false },
            },
            tx,
          );
        }
        return { unchanged: false };
      }

      const [row] = await tx
        .select({
          id: trafficReports.id,
          status: trafficReports.status,
          municipalityId: trafficReports.municipalityId,
          authorUserId: trafficReports.reportedByUserId,
          location: trafficReports.location,
          current: trafficReports.descriptionModerationStatus,
          categoryName: categories.name,
        })
        .from(trafficReports)
        .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
        .where(eq(trafficReports.id, input.target.ref))
        .limit(1)
        .for("update");
      if (!row) throw new ModerationError("not_found");
      assertModerates(viewer, row.municipalityId);
      if (row.current === input.status) return { unchanged: true };

      await tx
        .update(trafficReports)
        .set({
          descriptionModerationStatus: input.status,
          ...(input.status === "hidden"
            ? { reviewNote: input.reason ?? null }
            : {}),
        })
        .where(eq(trafficReports.id, row.id));
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: `traffic.text_${input.status === "published" ? "published" : "hidden"}`,
          subjectType: "traffic_report",
          subjectId: row.id,
          municipalityId: row.municipalityId,
          metadata: { from: row.current, reason: input.reason ?? null },
        },
        tx,
      );
      if (row.status === "active") {
        await publishRealtimeEvent(
          {
            channel: TRAFFIC_CHANNEL,
            municipalityId: row.municipalityId,
            subjectType: "traffic_report",
            subjectId: row.id,
            action: "updated",
            location: row.location,
          },
          tx,
        );
      }
      if (input.status === "hidden" && row.authorUserId) {
        await notify(
          {
            userId: row.authorUserId,
            messageKey: "notifications.trafficTextHidden",
            params: { description: row.categoryName },
            href: appTargetHref({ kind: "contributions" }),
            dedupeKey: `traffic:${row.id}:text-hidden:${input.requestId}`,
            channels: { push: false, email: false },
          },
          tx,
        );
      }
      return { unchanged: false };
    },
  });

  return { status: input.status };
}
