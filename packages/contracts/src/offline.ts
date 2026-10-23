import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { categoryKinds } from "./catalog";
import { routeOutput } from "./routes";

export const offlineBoundsSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);

export const offlineManifestOutput = z.object({
  version: z.string().min(1),
  generatedAt: z.iso.datetime(),
  bounds: offlineBoundsSchema,
  snapshotUrl: z.url(),
  snapshotSha256: z.string().regex(/^[0-9a-f]{64}$/),
  snapshotBytes: z.number().int().nonnegative(),
});

export type OfflineManifest = z.infer<typeof offlineManifestOutput>;

export const offlineCategorySchema = z.object({
  id: z.string(),
  kind: categoryKinds,
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  severity: z.enum(["blocking", "partial", "minor"]).nullable(),
  sortOrder: z.number().int(),
});

export type OfflineCategory = z.infer<typeof offlineCategorySchema>;

export const offlineBoundaryFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string(),
  properties: z.object({
    id: z.string(),
    name: z.string(),
    label: z.tuple([z.number(), z.number()]),
  }),
  geometry: z.unknown(),
});

export const offlineBoundariesSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(offlineBoundaryFeatureSchema),
  province: z.unknown().nullable(),
  outside: z.unknown().nullable(),
});

export type OfflineBoundaries = z.infer<typeof offlineBoundariesSchema>;

/**
 * Published place and business detail for offline use.
 *
 * Excludes per-account state (`isMine`, `myVerdict`, `mine`, `pending`),
 * private author references and expiring presigned URLs. Approved photographs
 * are listed by their IDs; `imageUrl` is retained only for non-expiring
 * static paths.
 */
export const offlinePlaceSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  imageUrl: z.string().nullable(),
  photoIds: z.array(z.uuid()),
  location: z.object({ lng: z.number(), lat: z.number() }),
  category: z.object({
    id: z.string(),
    kind: z.enum(["place", "business"]),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
  }),
  municipality: z.object({
    id: z.string(),
    name: z.string(),
  }),
  business: z
    .object({
      claimed: z.boolean(),
      contactPhone: z.string().nullable(),
      whatsapp: z.string().nullable(),
      openingHours: z.string().nullable(),
    })
    .nullable(),
});

export type OfflinePlace = z.infer<typeof offlinePlaceSchema>;

export const offlineRoadSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  kind: z.string(),
  path: z.array(z.object({ lng: z.number(), lat: z.number() })).min(2),
});

export type OfflineRoad = z.infer<typeof offlineRoadSchema>;

export const offlineSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  version: z.string().min(1),
  generatedAt: z.iso.datetime(),
  categories: z.array(offlineCategorySchema),
  boundaries: offlineBoundariesSchema,
  places: z.array(offlinePlaceSchema),
  routes: z.array(routeOutput),
  roads: z.array(offlineRoadSchema),
});

export type OfflineSnapshot = z.infer<typeof offlineSnapshotSchema>;

export const offlineContract = {
  manifest: oc
    .meta(
      openapi({
        method: "GET",
        path: "/offline/manifest",
        summary:
          "Current first-party offline snapshot manifest and pack bounds",
      }),
    )
    .output(offlineManifestOutput),
};
