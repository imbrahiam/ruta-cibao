import type { ApiInputs, ApiOutputs } from "@ruta/contracts";
import {
  DEFAULT_STREET_EXTENT,
  nearestOnPath,
  pathLength,
  windowAround,
} from "@ruta/shared/road-geometry";
import { getOfflineMeta, offlineCategories, offlineRoads } from "./store";

/** Snapshot v1 already includes every active category kind, including traffic. */
export async function offlineTrafficCategories(): Promise<
  ApiOutputs["traffic"]["categories"]
> {
  return (await offlineCategories()).filter((item) => item.kind === "traffic");
}

// Match the online lookup's reach; a bounding-box hit alone is not a road match.
const SEARCH_RADIUS_METRES = 45;
const SEARCH_MARGIN_DEGREES = 0.0006;

/**
 * Preview the nearest downloaded OSM way, clipped to the selected extent.
 * Only its road ID and the original crosshair enter the queued submission;
 * replay re-resolves the road (including named-way stitching) on the server.
 */
export async function offlineStreetAt(
  input: ApiInputs["traffic"]["streetAt"],
): Promise<ApiOutputs["traffic"]["streetAt"]> {
  const [roads, meta] = await Promise.all([
    offlineRoads({
      west: input.lng - SEARCH_MARGIN_DEGREES,
      south: input.lat - SEARCH_MARGIN_DEGREES,
      east: input.lng + SEARCH_MARGIN_DEGREES,
      north: input.lat + SEARCH_MARGIN_DEGREES,
    }),
    getOfflineMeta(),
  ]);
  const candidates = roads.flatMap((road) => {
    const nearest = nearestOnPath(road.path, input);
    return nearest && nearest.distance <= SEARCH_RADIUS_METRES
      ? [{ road, distance: nearest.distance }]
      : [];
  });
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      (a.road.id < b.road.id ? -1 : a.road.id > b.road.id ? 1 : 0),
  );
  const nearby = candidates.slice(0, 6);
  const nearest = input.roadId
    ? nearby.find(({ road }) => road.id === input.roadId)
    : nearby[0];
  const options = nearby.map(({ road, distance }) => ({
    id: road.id,
    name: road.name,
    distanceMeters: Math.round(distance),
  }));
  if (!nearest) {
    return {
      street: null,
      available: Boolean(meta?.roadCount),
      candidates: options,
    };
  }

  const extent = input.extentMeters ?? DEFAULT_STREET_EXTENT;
  const path =
    pathLength(nearest.road.path) <= extent
      ? nearest.road.path
      : windowAround(nearest.road.path, input, extent);
  return {
    street: {
      roadId: nearest.road.id,
      name: nearest.road.name,
      distanceMeters: Math.round(nearest.distance),
      path,
      lengthMeters: Math.round(pathLength(path)),
    },
    available: true,
    candidates: options,
  };
}
