import type { ApiOutputs } from "@ruta/contracts";
import type { MunicipalBoundaries } from "@ruta/shared/boundaries";
import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/api";
import { API_ORIGIN } from "@/lib/config";

export type TrafficReport = ApiOutputs["traffic"]["active"][number];
export type CommunityFeature = ApiOutputs["routes"]["map"]["features"][number];

const [WEST, SOUTH, EAST, NORTH] = PROVINCE_BOUNDS;
/** The province plus a margin, so a report on a border road is not cut off. */
const AREA = {
  west: WEST - 0.1,
  south: SOUTH - 0.1,
  east: EAST + 0.1,
  north: NORTH + 0.1,
};

/** Live traffic reports, refreshed every minute while the map is open. */
export function useTraffic(enabled: boolean) {
  return useQuery({
    ...orpc.traffic.active.queryOptions({ input: { ...AREA, limit: 200 } }),
    enabled,
    refetchInterval: 60_000,
  });
}

/** Published routes and located consultations, drawn as their own layers. */
export function useCommunity(enabled: boolean) {
  return useQuery({
    ...orpc.routes.map.queryOptions({ input: AREA }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** A published place as the map layer receives it. */
export type PlaceFeatureProperties = {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  municipality: string;
  color: string;
  icon: string;
};

export type PlaceFeature = GeoJSON.Feature<
  GeoJSON.Point,
  PlaceFeatureProperties
>;
export type PlaceCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  PlaceFeatureProperties
>;

export type Boundaries = MunicipalBoundaries & {
  features: Array<
    MunicipalBoundaries["features"][number] & { type: "Feature" }
  >;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`);
  if (!response.ok) {
    throw Object.assign(new Error(`GET ${path} failed`), {
      status: response.status,
    });
  }
  return (await response.json()) as T;
}

/**
 * Every published place, as one small GeoJSON payload: a province's worth of
 * points is cheaper as a single cached response than as a tile pyramid.
 */
export function usePlaceCollection() {
  return useQuery({
    queryKey: ["map", "places"],
    queryFn: () => getJson<PlaceCollection>("/api/places/geojson"),
    staleTime: 5 * 60_000,
  });
}

/** The three municipal polygons plus the province outline and its outside. */
export function useBoundaries() {
  return useQuery({
    queryKey: ["map", "boundaries"],
    queryFn: () => getJson<Boundaries>("/api/municipalities/boundaries"),
    staleTime: 24 * 60 * 60_000,
  });
}

export type CategorySummary = {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
};

/** The categories that actually have places, most populated first. */
export function categoriesOf(
  collection: PlaceCollection | undefined,
): CategorySummary[] {
  const byId = new Map<string, CategorySummary>();
  for (const { properties } of collection?.features ?? []) {
    const existing = byId.get(properties.category);
    if (existing) existing.count += 1;
    else
      byId.set(properties.category, {
        id: properties.category,
        name: properties.categoryName,
        icon: properties.icon,
        color: properties.color,
        count: 1,
      });
  }
  return [...byId.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}
