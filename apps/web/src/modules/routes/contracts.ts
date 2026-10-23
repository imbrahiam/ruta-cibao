import { z } from "zod";
import { mapPosition } from "@/modules/places/contracts";

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
