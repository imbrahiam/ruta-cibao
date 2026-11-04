"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { ContextPoint } from "./map-types";

const collection = z.object({
  features: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({ name: z.string() }),
    }),
  ),
});

const NONE: ContextPoint[] = [];

/**
 * The published places, from the public GeoJSON the rest of the product reads
 * (cached on the server), for the faint context dots on a large map. Fetched
 * only when a large map is on screen.
 */
export function useContextPlaces(enabled: boolean): ContextPoint[] {
  const query = useQuery({
    queryKey: ["admin-map-context"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ContextPoint[]> => {
      const response = await fetch("/api/places/geojson");
      if (!response.ok) throw new Error(`places geojson ${response.status}`);
      return collection
        .parse(await response.json())
        .features.map((feature) => ({
          id: String(feature.id),
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
          name: feature.properties.name,
        }));
    },
  });
  return query.data ?? NONE;
}
