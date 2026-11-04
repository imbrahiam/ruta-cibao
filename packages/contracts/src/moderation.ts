import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { decideClaimInput, pendingClaimShape } from "./businesses";
import { consultationPhoto, consultationStatusSchema } from "./consultations";
import { okOutput } from "./me";
import { contentTarget } from "./safety";
import { removeTrafficInput } from "./traffic";

/**
 * What a moderator can decide, as a shape.
 *
 * Six queues, two verdicts each, and a note that is optional in general but
 * required for the verdict that costs somebody something. Turning a submission
 * down without saying why is how a civic platform loses the people it needs
 * most, so the schema refuses to let it happen.
 *
 * One enum rather than one per feature, because the moderation desk is one
 * screen with one shape: a list, a card, two buttons, a note. Adding a queue
 * should be adding a tab, not a second desk.
 */
export const moderationQueue = z.enum([
  "places",
  "reports",
  "photos",
  "claims",
  "consultations",
  "traffic",
  "contentReports",
]);

export type ModerationQueueName = z.infer<typeof moderationQueue>;

export const queueInput = z.object({
  queue: moderationQueue,
  /** Omitted means every municipality the moderator is scoped to. */
  municipalityId: z.string().min(1).max(80).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const decidePlaceInput = z
  .object({
    requestId: z.uuid(),
    placeId: z.uuid(),
    decision: z.enum(["publish", "reject"]),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === "reject" && (value.note?.length ?? 0) < 10) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "moderation.noteRequired",
      });
    }
  });

export const decideReportInput = z.object({
  requestId: z.uuid(),
  reportId: z.uuid(),
  decision: z.enum(["resolved", "dismissed"]),
  note: z.string().trim().max(500).optional(),
});

export type QueueInput = z.infer<typeof queueInput>;
export type DecidePlaceInput = z.infer<typeof decidePlaceInput>;
export type DecideReportInput = z.infer<typeof decideReportInput>;

export const decidePhotoInput = z.object({
  requestId: z.uuid(),
  photoId: z.uuid(),
  decision: z.enum(["publish", "reject"]),
});

export type DecidePhotoInput = z.infer<typeof decidePhotoInput>;

export const pendingPlaceShape = z.object({
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
  submitterResidentVerified: z.boolean(),
});

export const pendingReportShape = z.object({
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

export const pendingPhotoShape = z.object({
  id: z.string(),
  url: z.string(),
  createdAt: z.iso.datetime(),
  placeName: z.string(),
  placeSlug: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  uploadedBy: z.string().nullable(),
});

const publicationShape = z.enum(["pending", "published", "hidden"]);

export const pendingCaseShape = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  body: z.string(),
  status: consultationStatusSchema,
  publicationStatus: publicationShape,
  createdAt: z.iso.datetime(),
  categoryName: z.string(),
  categoryIcon: z.string(),
  categoryColor: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  openedBy: z.string().nullable(),
  supportCount: z.number().int().nonnegative(),
  photos: z.array(consultationPhoto).max(4),
});

export const liveTrafficShape = z.object({
  id: z.string(),
  description: z.string().nullable(),
  descriptionModerationStatus: publicationShape,
  lng: z.number(),
  lat: z.number(),
  /** The stretch of road, when the report is one; null for a point report. */
  path: z.array(z.object({ lng: z.number(), lat: z.number() })).nullable(),
  /** Metres of road affected; null for a point report. */
  lengthMeters: z.number().int().nonnegative().nullable(),
  /** How much it costs a driver, as the municipality set it on the category. */
  severity: z.enum(["blocking", "partial", "minor"]).nullable(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  categoryName: z.string(),
  categoryIcon: z.string(),
  categoryColor: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  reportedBy: z.string().nullable(),
  reporterResidentVerified: z.boolean(),
});

export const contentReportShape = z.object({
  id: z.uuid(),
  subject: z.object({
    kind: contentTarget.shape.kind,
    ref: z.string(),
  }),
  /** A short label for the reviewer: a place name, a case title, a category. */
  subjectTitle: z.string().nullable(),
  /** Whether the content is currently shown to other people. */
  subjectVisible: z.boolean(),
  reason: z.enum(["abuse", "personal_information", "unsafe", "other"]),
  /** Threats and private information are reviewed first. */
  priority: z.boolean(),
  details: z.string().nullable(),
  createdAt: z.iso.datetime(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  reportedBy: z.string().nullable(),
  /** How many open reports this same content has. */
  openReportCount: z.number().int().positive(),
});

export const moderationCountsOutput = z.object({
  places: z.number(),
  reports: z.number(),
  photos: z.number(),
  claims: z.number(),
  consultations: z.number(),
  traffic: z.number(),
  contentReports: z.number(),
});

/**
 * One procedure, six queues: only the requested one is filled, the others are
 * empty arrays so the client renders from one constant shape.
 */
export const moderationQueueOutput = z.object({
  places: z.array(pendingPlaceShape),
  reports: z.array(pendingReportShape),
  photos: z.array(pendingPhotoShape),
  claims: z.array(pendingClaimShape),
  consultations: z.array(pendingCaseShape),
  traffic: z.array(liveTrafficShape),
  contentReports: z.array(contentReportShape),
});

export const decideContentReportInput = z.object({
  requestId: z.uuid(),
  reportId: z.uuid(),
  decision: z.enum(["actioned", "dismissed"]),
  reason: z.string().trim().min(10).max(500),
});
export const decideContentReportOutput = z.object({
  status: z.enum(["actioned", "dismissed"]),
});

/** Publish or hide a case, or the free text of a traffic report. */
export const decidePublicationInput = z
  .object({
    requestId: z.uuid(),
    target: z.object({
      kind: z.enum(["consultation", "traffic"]),
      ref: z.uuid(),
    }),
    status: z.enum(["published", "hidden"]),
    /** Required when hiding: the author is told why. */
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "hidden" && (value.reason?.length ?? 0) < 10) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "moderation.noteRequired",
      });
    }
  });
export const decidePublicationOutput = z.object({
  status: z.enum(["published", "hidden"]),
});

export type DecideContentReportInput = z.infer<typeof decideContentReportInput>;
export type DecidePublicationInput = z.infer<typeof decidePublicationInput>;

export const setResidencyVerifiedInput = z.object({
  requestId: z.uuid(),
  userId: z.string().min(1),
  municipalityId: z.string().min(1).max(80),
  verified: z.boolean(),
  reason: z.string().trim().min(10).max(500),
});

export const setResidencyVerifiedOutput = z.object({ verified: z.boolean() });

/** A stretch is at most 2 km of road; its vertices are a few metres apart at most. */
export const SNAP_ROAD_MAX_POINTS = 400;

export const snapRoadInput = z.object({
  path: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    )
    .min(2)
    .max(SNAP_ROAD_MAX_POINTS),
  /**
   * `stretch`: a reported road, laid on Google's centreline. `trail`: a route
   * traced by a person, laid on the streets it runs along.
   */
  mode: z.enum(["stretch", "trail"]).default("stretch"),
});

/**
 * The same stretch laid on the map provider's own road centreline, with a
 * vertex every few metres. `path` is null when the provider answered but the
 * stretch does not follow a road it knows (a trail, a path off the network), so
 * the caller keeps the geometry it already has.
 */
export const snapRoadOutput = z.object({
  path: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    )
    .nullable(),
});

/**
 * The moderation surface. Every procedure is moderator-only, scoped to the
 * municipalities the moderator may act on.
 */
export const moderationContract = {
  counts: oc
    .meta(
      openapi({
        method: "GET",
        path: "/moderation/counts",
        summary: "How much is waiting",
      }),
    )
    .output(moderationCountsOutput),

  queue: oc
    .meta(
      openapi({
        method: "GET",
        path: "/moderation/queue",
        summary: "What is waiting for a decision",
      }),
    )
    .input(queueInput)
    .output(moderationQueueOutput),

  decidePlace: oc
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/places/{placeId}",
        summary: "Publish or reject a submitted place",
      }),
    )
    .input(decidePlaceInput)
    .output(okOutput),

  decideReport: oc
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/reports/{reportId}",
        summary: "Resolve or dismiss a report",
      }),
    )
    .input(decideReportInput)
    .output(okOutput),

  decidePhoto: oc
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/photos/{photoId}",
        summary: "Publish or refuse a photo",
      }),
    )
    .input(decidePhotoInput)
    .output(okOutput),

  decideClaim: oc
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/claims/{claimId}",
        summary: "Approve or refuse a business claim",
      }),
    )
    .input(decideClaimInput)
    .output(okOutput),

  /**
   * Taking a traffic report down. Not a queue decision — the report is already
   * on the map — so the note is mandatory.
   */
  removeTraffic: oc
    .meta(
      openapi({
        method: "DELETE",
        path: "/moderation/traffic/{reportId}",
        summary: "Take a traffic report off the map",
      }),
    )
    .input(removeTrafficInput)
    .output(okOutput),

  decideContentReport: oc
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/content-reports/{reportId}",
        summary: "Action or dismiss a report about content",
      }),
    )
    .input(decideContentReportInput)
    .output(decideContentReportOutput),

  decidePublication: oc
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/publication",
        summary: "Publish or hide a case or a traffic report's text",
      }),
    )
    .input(decidePublicationInput)
    .output(decidePublicationOutput),

  setResidencyVerified: oc
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/members/{userId}/residency",
        summary: "Grant or revoke the in-person resident badge",
      }),
    )
    .input(setResidencyVerifiedInput)
    .output(setResidencyVerifiedOutput),

  snapRoad: oc
    .meta(
      openapi({
        method: "POST",
        path: "/moderation/snap-road",
        summary: "Lay a reported stretch on the map provider's road",
      }),
    )
    .input(snapRoadInput)
    .output(snapRoadOutput)
    .errors({
      SERVICE_UNAVAILABLE: {
        data: z.object({ reason: z.literal("unavailable") }),
      },
      TOO_MANY_REQUESTS: {
        data: z.object({ reason: z.literal("rate_limited") }),
      },
    }),
};
