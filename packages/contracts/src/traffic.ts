import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { DEFAULT_STREET_EXTENT } from "@ruta/shared/road-geometry";
import { z } from "zod";
import { categorySummary } from "./catalog";
import { mapPosition } from "./places";

export const streetExtent = z
  .union([z.literal(150), z.literal(500), z.literal(2000)])
  .default(DEFAULT_STREET_EXTENT);

/**
 * Reporting something on the road.
 *
 * The coordinate reuses `mapPosition` from the places contract rather than
 * redeclaring the province box: there is one answer to "which coordinates may
 * a citizen submit", and it should not be written twice.
 *
 * The description is optional. The category already says "vía bloqueada", and
 * demanding a sentence from somebody standing at the edge of a flooded road is
 * how a report never gets filed.
 *
 * A report is a point or a stretch. A hole is somewhere; a flood is somewhere
 * *along*, and standing a point in for it tells a driver the wrong thing twice
 * — it hides how much road is affected and puts the whole problem at one end.
 */

/** The client identifies a way and extent; the server supplies its geometry. */
export const trafficShape = z.enum(["point", "street"]);

export const reportTrafficInput = z.object({
  roadId: z.string().min(1).max(100).optional(),
  extentMeters: streetExtent,
  observedAt: z.iso.datetime(),
  requestId: z.uuid(),
  categoryId: z.string().min(1).max(80),
  /** Where the crosshair was. The server snaps it onto the street it finds. */
  location: mapPosition,
  shape: trafficShape.default("street"),
  description: z.string().trim().max(280).optional(),
});

export const reportTrafficOutput = z.object({
  id: z.string(),
  status: z.literal("active"),
  expiresAt: z.iso.datetime(),
});

export type ReportTrafficInput = z.infer<typeof reportTrafficInput>;

export const confirmTrafficInput = z.object({
  reportId: z.uuid(),
  verdict: z.enum(["still", "cleared"]),
});

export type ConfirmTrafficInput = z.infer<typeof confirmTrafficInput>;

/**
 * One report, as the map and the drawer read it.
 *
 * The reporter is a display name and a resident badge, never an account id: who filed a
 * report is context a reader needs, and an identifier is not.
 */
export const trafficReportShape = z.object({
  id: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  categoryIcon: z.string(),
  categoryColor: z.string(),
  /**
   * Free text, shown to others only once reviewed; its author always sees it.
   */
  description: z.string().nullable(),
  /** Where the free text is in review. Category and place are never held back. */
  descriptionModerationStatus: z.enum(["pending", "published", "hidden"]),
  lng: z.number(),
  lat: z.number(),
  /**
   * The stretch of road, when the report is one. Null for a point report.
   *
   * Snapped to the street on the way in, so the map draws the road rather than
   * a line across the blocks between the two ends.
   */
  path: z.array(z.object({ lng: z.number(), lat: z.number() })).nullable(),
  /** Metres of road affected. Null for a point report. */
  lengthMeters: z.number().int().nonnegative().nullable(),
  /**
   * `cleared` is a road neighbours say is open again, kept on the map for a
   * few hours because that is the answer somebody about to set off needs.
   */
  state: z.enum(["active", "cleared"]),
  /** How much this costs a driver. Set by the municipality on the category. */
  severity: z.enum(["blocking", "partial", "minor"]).nullable(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  reportedBy: z.string().nullable(),
  /** Whether the reporter holds the optional in-person municipal badge. */
  reporterResidentVerified: z.boolean(),
  /**
   * Everyone who has spoken about this report: whoever filed it, then whoever
   * confirmed or contradicted it. One entry per person.
   *
   * Each carries the optional in-person resident badge as context for a
   * reader; every verified account counts the same in the tally.
   */
  voices: z.array(
    z.object({
      /** Stable per report, and deliberately not the account id. */
      key: z.string(),
      name: z.string().nullable(),
      image: z.string().nullable(),
      residentVerified: z.boolean(),
    }),
  ),
  voiceCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  /** Headcount, not weight: it is shown to a person. */
  stillCount: z.number().int().nonnegative(),
  clearedCount: z.number().int().nonnegative(),
  /** What the caller already answered, so they are not asked twice. */
  myVerdict: z.enum(["still", "cleared"]).nullable(),
  /** Reporting a thing is not confirming it. */
  isMine: z.boolean(),
});

export const confirmTrafficOutput = z.object({
  status: z.enum(["active", "cleared"]),
  stillCount: z.number().int().nonnegative(),
  clearedCount: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime(),
});

/**
 * What the map asks for on a pan.
 *
 * A bounding box rather than a municipality: the viewport is what the reader
 * can see, and it crosses municipal borders all the time.
 */
export const activeTrafficInput = z.object({
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
  limit: z.number().int().min(1).max(200).default(100),
});

export type ActiveTrafficInput = z.infer<typeof activeTrafficInput>;

export const removeTrafficInput = z.object({
  requestId: z.uuid(),
  reportId: z.uuid(),
  note: z.string().trim().min(10).max(500),
});

export type RemoveTrafficInput = z.infer<typeof removeTrafficInput>;

/**
 * Which street is under this point.
 *
 * Its own procedure because the crosshair asks it while somebody is still
 * choosing — once the map settles, not on every frame — so the road they are
 * about to report is already shaded before they commit to it. The report looks
 * it up again on submit rather than trusting what came back here.
 */
/**
 * Deliberately not `mapPosition`.
 *
 * That schema bounds a coordinate to the province, which is right for something
 * being *submitted* and wrong for a lookup: the map pans past the provincial
 * line all the time, and answering a preview with a 400 turned every such pan
 * into "aquí no encontramos una calle". A point outside the province simply has
 * no street worth reporting, and saying so is the lookup's job, not the
 * schema's.
 */
export const streetAtInput = z.object({
  roadId: z.string().min(1).max(100).optional(),
  extentMeters: streetExtent,
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

const streetShape = z.object({
  roadId: z.string(),
  distanceMeters: z.number().nonnegative(),
  name: z.string().nullable(),
  path: z.array(z.object({ lng: z.number(), lat: z.number() })),
  lengthMeters: z.number().int().nonnegative(),
});

export const streetAtOutput = z.object({
  candidates: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      distanceMeters: z.number().nonnegative(),
    }),
  ),
  /** Null when there is no road within reach of the point. */
  street: streetShape.nullable(),
  /**
   * Whether there is a road network to look in at all.
   *
   * False on a deployment where `bun run db:roads` has not been run. The
   * difference from a null `street` matters: one says there is no road here,
   * the other says we cannot tell, and only the first is worth showing to
   * somebody standing on a road.
   */
  available: z.boolean(),
});

/**
 * Which roads are in view, so the picker can show what is tappable.
 *
 * A generous cap rather than none: a viewport zoomed out over three
 * municipalities holds thousands of ways, and drawing them all would be a blue
 * smear rather than a set of choices. Past the cap the crosshair still works,
 * which is why it never went away.
 */
export const streetsInViewInput = z.object({
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
  limit: z.number().int().min(1).max(400).default(250),
});

export const streetsInViewOutput = z.object({
  streets: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      path: z.array(z.object({ lng: z.number(), lat: z.number() })),
    }),
  ),
});

export const trafficContract = {
  /** The traffic taxonomy, for the report form and the legend. */
  categories: oc
    .meta(
      openapi({
        method: "GET",
        path: "/traffic/categories",
        summary: "Traffic report categories",
      }),
    )
    .output(z.array(categorySummary)),

  active: oc
    .meta(
      openapi({
        method: "GET",
        path: "/traffic",
        summary: "Traffic reports inside a bounding box",
      }),
    )
    .input(activeTrafficInput)
    .output(z.array(trafficReportShape)),

  detail: oc
    .meta(
      openapi({
        method: "GET",
        path: "/traffic/{id}",
        summary: "A current traffic report by id",
      }),
    )
    .input(z.object({ id: z.uuid() }))
    .output(trafficReportShape),

  report: oc
    .meta(
      openapi({
        method: "POST",
        path: "/traffic",
        successStatus: 201,
        summary: "Report something on the road",
      }),
    )
    .errors({
      DUPLICATE_REPORT: {
        status: 409,
        message: "That report already exists nearby.",
        data: z.object({
          reason: z.literal("duplicate"),
          existingReportId: z.uuid(),
        }),
      },
    })
    .input(reportTrafficInput)
    .output(reportTrafficOutput),

  streetAt: oc
    .meta(
      openapi({
        method: "POST",
        path: "/traffic/street",
        summary: "The street under a point",
      }),
    )
    .input(streetAtInput)
    .output(streetAtOutput),

  streetsInView: oc
    .meta(
      openapi({
        method: "GET",
        path: "/traffic/streets",
        summary: "Roads inside a bounding box",
      }),
    )
    .input(streetsInViewInput)
    .output(streetsInViewOutput),

  confirm: oc
    .meta(
      openapi({
        method: "POST",
        path: "/traffic/{reportId}/confirm",
        summary: "Say a report is still true, or is over",
      }),
    )
    .input(confirmTrafficInput)
    .output(confirmTrafficOutput),
};
