import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import { z } from "zod";
import { businessContact } from "./businesses";

/**
 * A coordinate a member may submit.
 *
 * The bounding box here is a cheap first pass, not the rule. The rule is
 * `ST_Contains` against the real municipal polygons, checked in the service —
 * a rectangle around this province reaches 25 km into Valverde on one side and
 * cuts the western edge of Sabaneta off on the other. Keeping the box means a
 * point on the far side of the country is refused by the schema before it costs
 * a database round trip.
 */
const [west, south, east, north] = PROVINCE_BOUNDS;

export const mapPosition = z.object({
  lng: z.number().min(west).max(east),
  lat: z.number().min(south).max(north),
});

export const submitPlaceInput = z.object({
  business: businessContact.optional(),
  requestId: z.uuid(),
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().min(20).max(600),
  address: z.string().trim().max(240).optional(),
  categoryId: z.string().min(1).max(80),
  location: mapPosition,
  /**
   * `gps` asserts the submitter was standing at the point; `map` that they
   * placed it by hand. Recorded so moderation can weigh the difference.
   */
  locationSource: z.enum(["map", "gps"]).default("map"),
});

export const submitPlaceOutput = z.object({
  id: z.string(),
  slug: z.string(),
  status: z.literal("pending"),
});

export const reportPlaceInput = z
  .object({
    requestId: z.uuid(),
    placeId: z.string(),
    reason: z.enum([
      "incorrect_information",
      "closed",
      "duplicate",
      "wrong_location",
      "other",
    ]),
    details: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.reason === "other" &&
      (!value.details || value.details.length < 10)
    ) {
      context.addIssue({
        code: "custom",
        path: ["details"],
        message: "map.place.reportForm.detailsRequired",
      });
    }
  });

export const reportPlaceOutput = z.object({
  id: z.string(),
  status: z.literal("pending"),
});

export type SubmitPlaceInput = z.infer<typeof submitPlaceInput>;
export type ReportPlaceInput = z.infer<typeof reportPlaceInput>;

export const browsePlacesInput = z.object({
  query: z.string().trim().max(100).default(""),
  category: z.string().max(80).default(""),
  municipality: z.string().max(80).default(""),
  offset: z.number().int().min(0).max(100_000).default(0),
  limit: z.number().int().min(1).max(48).default(12),
});

export type BrowsePlacesInput = z.infer<typeof browsePlacesInput>;

export const browsePlacesOutput = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      imageUrl: z.string().nullable(),
      thumbnailUrl: z.string().nullable().optional(),
      thumbnailSource: z.enum(["app", "google"]).nullable().optional(),
      categoryId: z.string(),
      categoryName: z.string(),
      categoryIcon: z.string(),
      categoryColor: z.string(),
      municipalityName: z.string(),
    }),
  ),
  total: z.number().int().nonnegative(),
});

/**
 * One person's whole history with the platform.
 *
 * The status enum is the union of six tables' own, which reads like a shortcut
 * and is the honest shape: the screen shows one badge per row, so a citizen
 * reading "en revisión" against a place and against a business claim is being
 * told the same thing, and splitting them would mean six badges that all mean
 * "wait".
 *
 * `href` comes from the service rather than being derived here, because where a
 * contribution lives depends on what it is — a place is on the map, a case has
 * a page, a lapsed traffic report has nowhere to go at all.
 */
export const contributionsOutput = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum([
      "draft",
      "pending",
      "published",
      "rejected",
      "archived",
      "resolved",
      "dismissed",
      "active",
      "cleared",
      "expired",
      "removed",
      "open",
      "in_review",
      "answered",
      "approved",
    ]),
    kind: z.enum([
      "place",
      "report",
      "photo",
      "traffic",
      "consultation",
      "claim",
    ]),
    note: z.string().nullable(),
    /**
     * Whether other people can see what was written: a case's publication, or
     * a traffic report's free text. Null where the notion does not apply.
     */
    publication: z.enum(["pending", "published", "hidden"]).nullable(),
    /** Null when there is nothing to open. */
    href: z.string().nullable(),
    createdAt: z.date(),
  }),
);

/** Roughly a full-resolution phone photo; anything larger is a mistake. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export const placeTrustOutput = z.object({
  state: z.enum(["new", "confirmed", "doubted", "established"]),
  confirmations: z.number(),
  doubts: z.number(),
  ageDays: z.number().nullable(),
});

export const placeDetailInput = z.object({ slug: z.string().min(1) });

export const placeDetailOutput = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  imageUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable().optional(),
  thumbnailSource: z.enum(["app", "google"]).nullable().optional(),
  location: z.object({ lng: z.number(), lat: z.number() }),
  category: z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
  }),
  municipality: z.object({ id: z.string(), name: z.string() }),
  photos: z.array(z.string()),
  /**
   * How much the map can vouch for this place, and why.
   *
   * Sent with the detail rather than fetched separately: it changes the first
   * sentence a reader forms about the place, so it cannot arrive afterwards.
   */
  trust: placeTrustOutput,
  /** What the caller already answered, so the prompt is not asked twice. */
  myVerdict: z.enum(["exists", "gone"]).nullable(),
  /** Vouching for your own submission is not evidence. */
  isMine: z.boolean(),
});

export const nearbyPlacesInput = z.object({
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  radiusMeters: z.number().int().min(50).max(20_000).default(2_000),
  limit: z.number().int().min(1).max(50).default(20),
});

export const nearbyPlacesOutput = z.array(
  z.object({
    slug: z.string(),
    name: z.string(),
    thumbnailUrl: z.string().nullable().optional(),
    thumbnailSource: z.enum(["app", "google"]).nullable().optional(),
    distanceMeters: z.number(),
    category: z.object({
      name: z.string(),
      icon: z.string(),
      color: z.string(),
    }),
  }),
);

export const searchPlacesInput = z.object({
  query: z.string().min(2).max(120),
  // Off while typing. The geocoder behind addresses is a shared public
  // service that forbids autocomplete, so it is asked only when the
  // person submits — see `@/lib/geocode` in the web app.
  addresses: z.boolean().default(false),
});

export const searchPlacesOutput = z.object({
  /** Whether asking for addresses can return anything at all. */
  geocoder: z.boolean(),
  places: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      thumbnailUrl: z.string().nullable().optional(),
      thumbnailSource: z.enum(["app", "google"]).nullable().optional(),
      categoryName: z.string(),
      categoryIcon: z.string(),
      color: z.string(),
      municipalityName: z.string(),
      lng: z.number(),
      lat: z.number(),
    }),
  ),
  addresses: z.array(
    z.object({
      name: z.string(),
      context: z.string().nullable(),
      lng: z.number(),
      lat: z.number(),
    }),
  ),
});

export const savedPlacesOutput = z.array(
  z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    thumbnailUrl: z.string().nullable().optional(),
    thumbnailSource: z.enum(["app", "google"]).nullable().optional(),
    categoryId: z.string(),
    categoryName: z.string(),
    color: z.string(),
    icon: z.string(),
    municipalityName: z.string(),
    lng: z.number(),
    lat: z.number(),
  }),
);

export const toggleSavedPlaceInput = z.object({
  placeId: z.uuid(),
  saved: z.boolean(),
});

export const toggleSavedPlaceOutput = z.object({ saved: z.boolean() });

export const confirmPlaceInput = z.object({
  placeId: z.uuid(),
  verdict: z.enum(["exists", "gone"]),
});

export const photoUploadInput = z.object({
  requestId: z.uuid(),
  placeId: z.uuid(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
});

export const photoUploadOutput = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("upload"),
    uploadUrl: z.string(),
    storageKey: z.string(),
  }),
  z.object({
    status: z.enum(["pending", "published"]),
    uploadUrl: z.null(),
    storageKey: z.string(),
  }),
]);

export const attachPhotoInput = z.object({
  placeId: z.uuid(),
  storageKey: z.string().min(1),
});

export const attachPhotoOutput = z.object({
  status: z.enum(["published", "pending"]),
});

export const placeCategoriesOutput = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
    kind: z.enum(["place", "business"]),
  }),
);

export const placesContract = {
  browse: oc
    .meta(
      openapi({
        method: "GET",
        path: "/places",
        summary: "Browse published places",
      }),
    )
    .input(browsePlacesInput)
    .output(browsePlacesOutput),

  contributions: oc
    .meta(
      openapi({
        method: "GET",
        path: "/me/contributions",
        summary: "The caller's submissions and review decisions",
      }),
    )
    .output(contributionsOutput),

  /**
   * One place, by slug.
   *
   * Public and limited to published rows: a pending submission is visible to
   * its author and the moderators through the review screens, not through a
   * guessable URL.
   */
  detail: oc
    .meta(
      openapi({
        method: "GET",
        path: "/places/{slug}",
        summary: "A single place",
      }),
    )
    .input(placeDetailInput)
    .output(placeDetailOutput),

  nearby: oc
    .meta(
      openapi({
        method: "GET",
        path: "/places/nearby",
        summary: "Places near a point",
      }),
    )
    .input(nearbyPlacesInput)
    .output(nearbyPlacesOutput),

  search: oc
    .meta(
      openapi({
        method: "GET",
        path: "/places/search",
        summary: "Search places and addresses",
      }),
    )
    .input(searchPlacesInput)
    .output(searchPlacesOutput),

  saved: oc
    .meta(
      openapi({
        method: "GET",
        path: "/places/saved",
        summary: "Places the caller kept",
      }),
    )
    .output(savedPlacesOutput),

  toggleSaved: oc
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/saved",
        summary: "Keep or release a place",
      }),
    )
    .input(toggleSavedPlaceInput)
    .output(toggleSavedPlaceOutput),

  confirm: oc
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/confirm",
        summary: "Confirm a place is still there, or is not",
      }),
    )
    .input(confirmPlaceInput)
    .output(placeTrustOutput),

  /** A URL the browser may PUT one photo to, and nothing else. */
  photoUpload: oc
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/photo-upload",
        summary: "Ask for a photo upload URL",
      }),
    )
    .input(photoUploadInput)
    .errors({ CONFLICT: { data: z.object({ reason: z.literal("conflict") }) } })
    .output(photoUploadOutput),

  /** Tells the app about a photo that finished uploading. */
  attachPhoto: oc
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/photos",
        summary: "Record an uploaded photo",
      }),
    )
    .input(attachPhotoInput)
    .output(attachPhotoOutput),

  /** The active taxonomy, for the layer filter chips. */
  categories: oc
    .meta(
      openapi({
        method: "GET",
        path: "/places/categories",
        summary: "Place categories",
      }),
    )
    .output(placeCategoriesOutput),

  submit: oc
    .meta(
      openapi({
        method: "POST",
        path: "/places",
        successStatus: 201,
        summary: "Submit a place for moderation",
      }),
    )
    .input(submitPlaceInput)
    .output(submitPlaceOutput),

  report: oc
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/reports",
        successStatus: 201,
        summary: "Report a problem with a place",
      }),
    )
    .input(reportPlaceInput)
    .output(reportPlaceOutput),
};
