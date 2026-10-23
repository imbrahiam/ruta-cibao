import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import { z } from "zod";
import { businessContact } from "@/modules/businesses/contracts";

/**
 * A coordinate a citizen may submit.
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
   * `gps` asserts the submitter was standing at the point. The server only
   * accepts that from a verified citizen; everyone else sends `map`.
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
    /** Null when there is nothing to open. */
    href: z.string().nullable(),
    createdAt: z.date(),
  }),
);
