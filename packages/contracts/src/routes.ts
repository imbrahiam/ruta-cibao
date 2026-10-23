import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { mapPosition } from "./places";

export const difficulty = z.enum(["easy", "moderate", "hard"]);
export const routeServices = z.enum([
  "water",
  "food",
  "lodging",
  "guide",
  "parking",
  "restrooms",
]);
export const submitRouteInput = z.object({
  requestId: z.uuid(),
  name: z.string().trim().min(5).max(120),
  description: z.string().trim().min(40).max(3000),
  categoryId: z.string().min(1).max(100),
  path: z.array(mapPosition).min(2).max(500),
  durationMinutes: z.number().int().min(5).max(10080),
  difficulty,
  services: z
    .array(routeServices)
    .max(6)
    .transform((items) => [...new Set(items)]),
});
export type SubmitRouteInput = z.infer<typeof submitRouteInput>;
export const browseRoutesInput = z.object({
  scope: z.enum(["published", "mine", "pending"]).default("published"),
  municipalityId: z.string().max(80).optional(),
  difficulty: difficulty.optional(),
  offset: z.number().int().min(0).max(100000).default(0),
  limit: z.number().int().min(1).max(100).default(24),
});
export type BrowseRoutesInput = z.infer<typeof browseRoutesInput>;
export const decideRouteInput = z.object({
  requestId: z.uuid(),
  id: z.uuid(),
  status: z.enum(["published", "rejected"]),
  note: z.string().trim().min(5).max(1000),
});
export type DecideRouteInput = z.infer<typeof decideRouteInput>;
export const routeOutput = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  path: z.array(mapPosition),
  difficulty,
  durationMinutes: z.number(),
  distanceMeters: z.number(),
  services: z.array(routeServices),
  status: z.enum(["pending", "published", "rejected"]),
  reviewNote: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type EcoRoute = z.infer<typeof routeOutput>;

export const mapFeaturesInput = z
  .object({
    west: z.number().min(-180).max(180),
    east: z.number().min(-180).max(180),
    south: z.number().min(-90).max(90),
    north: z.number().min(-90).max(90),
  })
  .refine((box) => box.west < box.east && box.south < box.north);
export type MapFeaturesInput = z.infer<typeof mapFeaturesInput>;
export const communityFeature = z.object({
  id: z.string(),
  kind: z.enum(["route", "consultation"]),
  title: z.string(),
  color: z.string(),
  lng: z.number(),
  lat: z.number(),
  path: z.array(z.object({ lng: z.number(), lat: z.number() })).nullable(),
  href: z.string(),
});
export type CommunityFeature = z.infer<typeof communityFeature>;
export const mapFeaturesOutput = z.object({
  features: z.array(communityFeature),
  truncated: z.boolean(),
});
export const routeCategoriesOutput = z.array(
  z.object({ id: z.string(), name: z.string() }),
);
export const browseRoutesOutput = z.object({
  items: z.array(routeOutput),
  total: z.number(),
});
export const routeDetailInput = z.object({ id: z.uuid() });
export const submitRouteOutput = z.object({
  id: z.uuid(),
  status: z.literal("pending"),
});
export const decideRouteOutput = z.object({
  status: z.enum(["published", "rejected"]),
});

export const routesContract = {
  map: oc
    .meta(openapi({ method: "GET", path: "/map/community" }))
    .input(mapFeaturesInput)
    .output(mapFeaturesOutput),
  categories: oc
    .meta(openapi({ method: "GET", path: "/routes/categories" }))
    .output(routeCategoriesOutput),
  browse: oc
    .meta(openapi({ method: "GET", path: "/routes" }))
    .input(browseRoutesInput)
    .output(browseRoutesOutput),
  detail: oc
    .meta(openapi({ method: "GET", path: "/routes/{id}" }))
    .input(routeDetailInput)
    .output(routeOutput),
  submit: oc
    .meta(openapi({ method: "POST", path: "/routes", successStatus: 201 }))
    .input(submitRouteInput)
    .output(submitRouteOutput),
  decide: oc
    .meta(openapi({ method: "POST", path: "/routes/{id}/decision" }))
    .input(decideRouteInput)
    .output(decideRouteOutput),
};
