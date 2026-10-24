import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

/** Dominican Republic and its immediate coastal approaches. */
export const directionsPosition = z.object({
  lat: z.number().min(17).max(20.5),
  lng: z.number().min(-72.1).max(-68),
});

export const computeDirectionsInput = z.object({
  origin: directionsPosition,
  destination: directionsPosition,
  mode: z.enum(["drive", "walk"]),
});

export const computeDirectionsOutput = z.object({
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  path: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    )
    .min(2),
  steps: z.array(
    z.object({
      instruction: z.string(),
      distanceMeters: z.number().nonnegative(),
      maneuver: z.string().nullable(),
    }),
  ),
});

export type ComputeDirectionsInput = z.infer<typeof computeDirectionsInput>;
export type ComputeDirectionsOutput = z.infer<typeof computeDirectionsOutput>;

export const directionsContract = {
  compute: oc
    .meta(
      openapi({
        method: "POST",
        path: "/directions",
        summary: "Compute driving or walking directions",
      }),
    )
    .input(computeDirectionsInput)
    .output(computeDirectionsOutput)
    .errors({
      NOT_FOUND: { data: z.object({ reason: z.literal("no_route") }) },
      SERVICE_UNAVAILABLE: {
        data: z.object({ reason: z.literal("unavailable") }),
      },
      TOO_MANY_REQUESTS: {
        data: z.object({ reason: z.literal("rate_limited") }),
      },
    }),
};
