import { ORPCError } from "@orpc/server";
import {
  type ComputeDirectionsInput,
  type ComputeDirectionsOutput,
  computeDirectionsOutput,
} from "@ruta/contracts";
import { decodePolyline } from "@ruta/shared/polyline";
import { z } from "zod";
import { env } from "@/lib/env";

const providerResponse = z.object({
  routes: z
    .array(
      z.object({
        distanceMeters: z.number().int().nonnegative().default(0),
        duration: z.string().regex(/^\d+(?:\.\d+)?s$/),
        polyline: z.object({ encodedPolyline: z.string().min(1) }),
        legs: z
          .array(
            z.object({
              steps: z
                .array(
                  z.object({
                    navigationInstruction: z
                      .object({
                        instructions: z.string().optional(),
                        maneuver: z.string().optional(),
                      })
                      .optional(),
                    distanceMeters: z.number().int().nonnegative().default(0),
                  }),
                )
                .default([]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

function unavailable() {
  return new ORPCError("SERVICE_UNAVAILABLE", {
    data: { reason: "unavailable" },
  });
}

/** Read-only, uncached routing: no origin coordinates or provider bodies are logged. */
export async function computeDirections(
  input: ComputeDirectionsInput,
): Promise<ComputeDirectionsOutput> {
  const key = env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) throw unavailable();

  let data: z.infer<typeof providerResponse>;
  try {
    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters",
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: input.origin.lat,
                longitude: input.origin.lng,
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: input.destination.lat,
                longitude: input.destination.lng,
              },
            },
          },
          travelMode: input.mode === "drive" ? "DRIVE" : "WALK",
          languageCode: "es",
          regionCode: "DO",
          ...(input.mode === "drive"
            ? { routingPreference: "TRAFFIC_UNAWARE" }
            : {}),
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) throw unavailable();
    data = providerResponse.parse(await response.json());
  } catch {
    throw unavailable();
  }

  const route = data.routes[0];
  if (!route)
    throw new ORPCError("NOT_FOUND", { data: { reason: "no_route" } });

  try {
    return computeDirectionsOutput.parse({
      distanceMeters: route.distanceMeters,
      durationSeconds: Number(route.duration.slice(0, -1)),
      path: decodePolyline(route.polyline.encodedPolyline),
      steps: route.legs.flatMap((leg) =>
        leg.steps.map((step) => ({
          instruction: step.navigationInstruction?.instructions ?? "",
          distanceMeters: step.distanceMeters,
          maneuver: step.navigationInstruction?.maneuver ?? null,
        })),
      ),
    });
  } catch {
    throw unavailable();
  }
}
