import { openapi } from "@orpc/openapi";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
  decideClaimInput,
  pendingClaimShape,
} from "@/modules/businesses/contracts";
import { consultationStatusSchema } from "@/modules/consultations/contracts";
import {
  decidePhotoInput,
  decidePlaceInput,
  decideReportInput,
  queueInput,
} from "@/modules/moderation/contracts";
import {
  decideBusinessClaim,
  decidePhoto,
  decidePlace,
  decideReport,
  ModerationError,
  removeTrafficReport,
} from "@/modules/moderation/decide";
import {
  liveTrafficReports,
  pendingClaims,
  pendingConsultations,
  pendingPhotos,
  pendingPlaces,
  pendingReports,
  queueCounts,
} from "@/modules/moderation/queue";
import { removeTrafficInput } from "@/modules/traffic/contracts";
import { moderatorProcedure } from "../base";

/**
 * The moderation surface.
 *
 * Every procedure here is behind `moderatorProcedure`, which hands the handler
 * a viewer already carrying the municipalities it may act on — so widening the
 * scope has to be deliberate rather than accidental.
 */
function asOrpcError(error: unknown): never {
  if (error instanceof ModerationError) {
    throw new ORPCError(
      error.reason === "not_found" ? "NOT_FOUND" : "CONFLICT",
      {
        message:
          error.reason === "not_found"
            ? "That item no longer exists."
            : "Somebody else already decided this one.",
        data: { reason: error.reason },
      },
    );
  }
  throw error;
}

const pendingPlace = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  lng: z.number(),
  lat: z.number(),
  locationSource: z.enum(["map", "gps"]),
  createdAt: z.iso.datetime(),
  categoryName: z.string(),
  categoryColor: z.string(),
  categoryIcon: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  submittedBy: z.string().nullable(),
  submitterTier: z.enum(["visitor", "citizen"]).nullable(),
});

const pendingReport = z.object({
  id: z.string(),
  reason: z.enum([
    "incorrect_information",
    "closed",
    "duplicate",
    "wrong_location",
    "other",
  ]),
  details: z.string().nullable(),
  createdAt: z.iso.datetime(),
  placeId: z.string(),
  placeName: z.string(),
  placeSlug: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  reportedBy: z.string().nullable(),
});

const pendingPhoto = z.object({
  id: z.string(),
  url: z.string(),
  createdAt: z.iso.datetime(),
  placeName: z.string(),
  placeSlug: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  uploadedBy: z.string().nullable(),
});

const pendingCase = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  body: z.string(),
  status: consultationStatusSchema,
  createdAt: z.iso.datetime(),
  categoryName: z.string(),
  categoryIcon: z.string(),
  categoryColor: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  openedBy: z.string().nullable(),
  supportCount: z.number().int().nonnegative(),
});

const liveTraffic = z.object({
  id: z.string(),
  description: z.string().nullable(),
  lng: z.number(),
  lat: z.number(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  categoryName: z.string(),
  categoryIcon: z.string(),
  categoryColor: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  reportedBy: z.string().nullable(),
  reporterTier: z.enum(["visitor", "citizen"]).nullable(),
});

export const moderationRouter = {
  /** How much is waiting, for the badge and the empty state. */
  counts: moderatorProcedure
    .meta(
      openapi({
        method: "GET",
        path: "/moderation/counts",
        summary: "How much is waiting",
      }),
    )
    .output(
      z.object({
        places: z.number(),
        reports: z.number(),
        photos: z.number(),
        claims: z.number(),
        consultations: z.number(),
        traffic: z.number(),
      }),
    )
    .handler(({ context }) => queueCounts(context.viewer)),

  queue: moderatorProcedure
    .meta(
      openapi({
        method: "GET",
        path: "/moderation/queue",
        summary: "What is waiting for a decision",
      }),
    )
    .input(queueInput)
    .output(
      z.object({
        places: z.array(pendingPlace),
        reports: z.array(pendingReport),
        photos: z.array(pendingPhoto),
        claims: z.array(pendingClaimShape),
        consultations: z.array(pendingCase),
        traffic: z.array(liveTraffic),
      }),
    )
    // One procedure, six queues, and only the requested one is read. The empty
    // arrays keep the response shape constant, so the client renders from one
    // type rather than six optional ones.
    .handler(async ({ context, input }) => ({
      places:
        input.queue === "places"
          ? await pendingPlaces(context.viewer, input)
          : [],
      reports:
        input.queue === "reports"
          ? await pendingReports(context.viewer, input)
          : [],
      photos:
        input.queue === "photos"
          ? await pendingPhotos(context.viewer, input)
          : [],
      claims:
        input.queue === "claims"
          ? await pendingClaims(context.viewer, input)
          : [],
      consultations:
        input.queue === "consultations"
          ? await pendingConsultations(context.viewer, input)
          : [],
      traffic:
        input.queue === "traffic"
          ? await liveTrafficReports(context.viewer, input)
          : [],
    })),

  decidePlace: moderatorProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/places/{placeId}",
        summary: "Publish or reject a submitted place",
      }),
    )
    .input(decidePlaceInput)
    .output(z.object({ status: z.literal("ok") }))
    .handler(({ context, input }) =>
      decidePlace(context.viewer, input).catch(asOrpcError),
    ),

  decideReport: moderatorProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/reports/{reportId}",
        summary: "Resolve or dismiss a report",
      }),
    )
    .input(decideReportInput)
    .output(z.object({ status: z.literal("ok") }))
    .handler(({ context, input }) =>
      decideReport(context.viewer, input).catch(asOrpcError),
    ),

  decidePhoto: moderatorProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/photos/{photoId}",
        summary: "Publish or refuse a photo",
      }),
    )
    .input(decidePhotoInput)
    .output(z.object({ status: z.literal("ok") }))
    .handler(({ context, input }) =>
      decidePhoto(context.viewer, input).catch(asOrpcError),
    ),

  decideClaim: moderatorProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/claims/{claimId}",
        summary: "Approve or refuse a business claim",
      }),
    )
    .input(decideClaimInput)
    .output(z.object({ status: z.literal("ok") }))
    .handler(({ context, input }) =>
      decideBusinessClaim(context.viewer, input).catch(asOrpcError),
    ),

  /**
   * Taking a traffic report down.
   *
   * Not a queue decision — the report is already on the map — so the verb is
   * `remove` rather than `decide`, and the note is mandatory: this one always
   * costs the reporter something.
   */
  removeTraffic: moderatorProcedure
    .meta(
      openapi({
        method: "DELETE",
        path: "/moderation/traffic/{reportId}",
        summary: "Take a traffic report off the map",
      }),
    )
    .input(removeTrafficInput)
    .output(z.object({ status: z.literal("ok") }))
    .handler(({ context, input }) =>
      removeTrafficReport(context.viewer, input).catch(asOrpcError),
    ),
};
