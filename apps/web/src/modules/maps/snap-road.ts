import {
  nearestOnPath,
  type PathPoint,
  pathLength,
} from "@ruta/shared/road-geometry";
import { z } from "zod";
import { env } from "@/lib/env";
import { cleanCentreline } from "./centreline";

/**
 * Lays a stretch on Google's own road centreline.
 *
 * The stretches are cut from OpenStreetMap, whose geometry is a few metres off
 * Google's and has a vertex only where the road bends, so drawn on a Google
 * basemap they sit beside the road they describe. The Roads API `snapToRoads`
 * (with `interpolate`) answers with Google's own vertices, a few metres apart,
 * which is what makes a highlight hug the curves; `cleanCentreline` turns
 * them into one smooth line, without the provider's steps and spurs.
 */

const ENDPOINT = "https://roads.googleapis.com/v1/snapToRoads";

/** The API takes at most 100 points per call. */
const CHUNK = 100;

/** The provider is asked quickly or not at all: the caller has a drawing to fall back on. */
const TIMEOUT_MS = 6_000;

/** A snapped vertex further than this from the original line jumped to another road. */
const MAX_DEVIATION_METRES = 25;

/** Snapped length against original: a detour down a side street makes it far longer. */
const LENGTH_RATIO = { min: 0.85, max: 1.3 };

/** Stretches are few and a road does not move: remembered for the life of the process. */
const CACHE_LIMIT = 1_000;
const cache = new Map<string, PathPoint[] | null>();

export class SnapUnavailableError extends Error {
  constructor() {
    super("Road snapping is unavailable.");
  }
}

const response = z.object({
  snappedPoints: z
    .array(
      z.object({
        location: z.object({ latitude: z.number(), longitude: z.number() }),
      }),
    )
    .default([]),
});

async function snapChunk(
  points: PathPoint[],
  key: string,
): Promise<PathPoint[]> {
  const query = new URLSearchParams({
    path: points
      .map((point) => `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`)
      .join("|"),
    interpolate: "true",
    key,
  });
  let body: unknown;
  try {
    // Errors are rethrown without the URL, which carries the key.
    const result = await fetch(`${ENDPOINT}?${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!result.ok) throw new SnapUnavailableError();
    body = await result.json();
  } catch {
    throw new SnapUnavailableError();
  }
  const parsed = response.safeParse(body);
  if (!parsed.success) throw new SnapUnavailableError();
  return parsed.data.snappedPoints.map((point) => ({
    lat: point.location.latitude,
    lng: point.location.longitude,
  }));
}

/** Whether the snapped line is the same road as the original, not a neighbour. */
function followsOriginal(original: PathPoint[], snapped: PathPoint[]): boolean {
  if (snapped.length < 2) return false;
  const before = pathLength(original);
  const after = pathLength(snapped);
  if (before === 0) return false;
  const ratio = after / before;
  if (ratio < LENGTH_RATIO.min || ratio > LENGTH_RATIO.max) return false;
  return snapped.every((point) => {
    const near = nearestOnPath(original, point);
    return near !== null && near.distance <= MAX_DEVIATION_METRES;
  });
}

function cacheKey(path: PathPoint[]): string {
  return path
    .map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`)
    .join(";");
}

/**
 * The path on the road, or null when it does not follow one.
 *
 * Throws `SnapUnavailableError` when the provider cannot be asked or does not
 * answer, so that outcome is retried later instead of being remembered as "this
 * is not a road".
 */
export async function snapToRoad(
  path: PathPoint[],
): Promise<PathPoint[] | null> {
  const id = cacheKey(path);
  const known = cache.get(id);
  if (known !== undefined) return known;

  const key = env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) throw new SnapUnavailableError();

  // Consecutive chunks share one point so the pieces join without a gap.
  const chunks: PathPoint[][] = [];
  for (let start = 0; start < path.length - 1; start += CHUNK - 1) {
    chunks.push(path.slice(start, start + CHUNK));
  }
  const pieces = await Promise.all(
    chunks.map((chunk) => snapChunk(chunk, key)),
  );

  const snapped = cleanCentreline(pieces.flat());
  const result = followsOriginal(path, snapped) ? snapped : null;

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(id, result);
  return result;
}

/** Routes accept 25 intermediate waypoints at most. */
const MAX_WAYPOINTS = 23;
/** A walking route may detour, but not into another part of town. */
const TRAIL_LENGTH_RATIO = { min: 0.7, max: 2.5 };
const routeCache = new Map<string, PathPoint[] | null>();

/**
 * GeoJSON, not the encoded polyline: that one is rounded to 1e-5 degrees
 * (about a metre), which is steps of half a metre beside the road at street zoom.
 */
const routeResponse = z.object({
  routes: z
    .array(
      z.object({
        polyline: z.object({
          geoJsonLinestring: z.object({
            coordinates: z.array(z.tuple([z.number(), z.number()])),
          }),
        }),
      }),
    )
    .default([]),
});

function sample(path: PathPoint[], count: number): PathPoint[] {
  if (path.length <= count) return path;
  const step = (path.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, index) => {
    const point = path[Math.round(index * step)];
    return point as PathPoint;
  });
}

/**
 * A traced route laid on the streets it runs along, as Google routes it on
 * foot through the traced points, so the line sits on real street geometry.
 * Null when the walk is not plausibly the same route.
 */
export async function routeOnStreets(
  path: PathPoint[],
): Promise<PathPoint[] | null> {
  const id = cacheKey(path);
  const known = routeCache.get(id);
  if (known !== undefined) return known;

  const key = env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) throw new SnapUnavailableError();

  const points = sample(path, MAX_WAYPOINTS + 2);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const location = (point: PathPoint, via = false) => ({
    location: { latLng: { latitude: point.lat, longitude: point.lng } },
    ...(via ? { via: true } : {}),
  });

  let body: unknown;
  try {
    const result = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "routes.polyline.geoJsonLinestring",
        },
        body: JSON.stringify({
          origin: location(first),
          destination: location(last),
          intermediates: points
            .slice(1, -1)
            .map((point) => location(point, true)),
          travelMode: "WALK",
          polylineQuality: "HIGH_QUALITY",
          polylineEncoding: "GEO_JSON_LINESTRING",
          regionCode: "DO",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!result.ok) throw new SnapUnavailableError();
    body = await result.json();
  } catch {
    throw new SnapUnavailableError();
  }
  const parsed = routeResponse.safeParse(body);
  const coordinates = parsed.success
    ? parsed.data.routes[0]?.polyline.geoJsonLinestring.coordinates
    : undefined;
  let result: PathPoint[] | null = null;
  if (coordinates) {
    const walked = cleanCentreline(
      coordinates.map(([lng, lat]) => ({ lat, lng })),
    );
    const ratio = pathLength(walked) / Math.max(pathLength(path), 1);
    if (
      walked.length > 1 &&
      ratio >= TRAIL_LENGTH_RATIO.min &&
      ratio <= TRAIL_LENGTH_RATIO.max
    ) {
      result = walked;
    }
  }
  if (routeCache.size >= CACHE_LIMIT) {
    const oldest = routeCache.keys().next().value;
    if (oldest !== undefined) routeCache.delete(oldest);
  }
  routeCache.set(id, result);
  return result;
}
