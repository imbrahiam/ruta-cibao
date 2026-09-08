export type PathPoint = { lng: number; lat: number };

export type Street = {
  roadId: string;
  distanceMeters: number;
  /** As OSM has it. Null for the many rural roads with no name on them. */
  name: string | null;
  path: PathPoint[];
  lengthMeters: number;
};

/** Metres between two coordinates, on a sphere. Good enough at this scale. */
export function distanceMetres(a: PathPoint, b: PathPoint): number {
  const R = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The total length of a path, in metres. */
export function pathLength(path: PathPoint[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (previous && current) total += distanceMetres(previous, current);
  }
  return total;
}

/**
 * The point halfway along a path, measured by distance rather than by index.
 *
 * A street's vertices bunch at its corners, so the middle element of the array
 * can sit a long way from the middle of the road. This is the coordinate the
 * marker and the "near me" fan-out both use, so it has to be where a person
 * would point when asked where the problem is.
 */
export function pathMidpoint(path: PathPoint[]): PathPoint {
  const first = path[0];
  if (!first) throw new Error("A path needs at least one point.");
  if (path.length === 1) return first;

  const half = pathLength(path) / 2;
  let travelled = 0;

  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (!from || !to) continue;

    const leg = distanceMetres(from, to);
    if (travelled + leg >= half) {
      const ratio = leg === 0 ? 0 : (half - travelled) / leg;
      return {
        lng: from.lng + (to.lng - from.lng) * ratio,
        lat: from.lat + (to.lat - from.lat) * ratio,
      };
    }
    travelled += leg;
  }

  return path[path.length - 1] ?? first;
}

/**
 * Where on a path a point actually falls.
 *
 * The perpendicular foot on the nearest segment, not the nearest vertex — a
 * street drawn as two points a hundred metres apart would otherwise report the
 * crosshair as being at one end of it when it is standing in the middle.
 *
 * Longitude is scaled by `cos(latitude)` so the comparison happens in something
 * close to metres. At 19° north that is a factor of 0.95, and skipping it makes
 * east–west streets read as nearer than they are.
 */
export function nearestOnPath(
  path: PathPoint[],
  point: PathPoint,
): { point: PathPoint; segment: number; distance: number } | null {
  const scale = Math.cos((point.lat * Math.PI) / 180);
  let best: { point: PathPoint; segment: number; distance: number } | null =
    null;

  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (!from || !to) continue;

    const dx = (to.lng - from.lng) * scale;
    const dy = to.lat - from.lat;
    const lengthSquared = dx * dx + dy * dy;

    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point.lng - from.lng) * scale * dx +
                (point.lat - from.lat) * dy) /
                lengthSquared,
            ),
          );

    const foot = {
      lng: from.lng + (to.lng - from.lng) * t,
      lat: from.lat + (to.lat - from.lat) * t,
    };
    const distance = distanceMetres(point, foot);

    if (!best || distance < best.distance) {
      best = { point: foot, segment: index - 1, distance };
    }
  }

  return best;
}

/**
 * The stretch of a way around a point, at most `maxMetres` long.
 *
 * OSM draws a road as one way until something about it changes, which in this
 * province can mean several kilometres. Shading all of it would say the whole
 * road is flooded when what is flooded is the bit by the bridge — so the report
 * covers a window centred on where the person put the crosshair.
 */
export function windowAround(
  path: PathPoint[],
  anchor: PathPoint,
  maxMetres: number,
): PathPoint[] {
  const nearest = nearestOnPath(path, anchor);
  if (!nearest) return path;

  const budget = maxMetres / 2;
  const before: PathPoint[] = [];
  const after: PathPoint[] = [];

  // Backwards from the foot of the perpendicular, then forwards, spending half
  // the budget each way and stopping mid-segment when it runs out.
  let remaining = budget;
  let cursor = nearest.point;
  for (let index = nearest.segment; index >= 0; index -= 1) {
    const vertex = path[index];
    if (!vertex) continue;
    const leg = distanceMetres(cursor, vertex);
    if (leg > remaining) {
      const ratio = leg === 0 ? 0 : remaining / leg;
      before.unshift({
        lng: cursor.lng + (vertex.lng - cursor.lng) * ratio,
        lat: cursor.lat + (vertex.lat - cursor.lat) * ratio,
      });
      break;
    }
    before.unshift(vertex);
    remaining -= leg;
    cursor = vertex;
  }

  remaining = budget;
  cursor = nearest.point;
  for (let index = nearest.segment + 1; index < path.length; index += 1) {
    const vertex = path[index];
    if (!vertex) continue;
    const leg = distanceMetres(cursor, vertex);
    if (leg > remaining) {
      const ratio = leg === 0 ? 0 : remaining / leg;
      after.push({
        lng: cursor.lng + (vertex.lng - cursor.lng) * ratio,
        lat: cursor.lat + (vertex.lat - cursor.lat) * ratio,
      });
      break;
    }
    after.push(vertex);
    remaining -= leg;
    cursor = vertex;
  }

  return [...before, nearest.point, ...after];
}

export type RoadAnchor = PathPoint & { roadId?: string };
export const STREET_EXTENTS = [150, 500, 2000] as const;
export type StreetExtent = (typeof STREET_EXTENTS)[number];
export const DEFAULT_STREET_EXTENT: StreetExtent = 500;

/** The closest actual segment, not its bounding box or nearest vertex. */
export function nearestRoad<T extends { id: string; path: PathPoint[] }>(
  roads: T[],
  point: PathPoint,
  radiusMetres: number,
) {
  let best: { road: T; point: PathPoint; distance: number } | null = null;
  for (const road of roads) {
    const projected = nearestOnPath(road.path, point);
    if (!projected || projected.distance > radiusMetres) continue;
    if (
      !best ||
      projected.distance < best.distance ||
      (projected.distance === best.distance && road.id < best.road.id)
    )
      best = { road, point: projected.point, distance: projected.distance };
  }
  return best;
}
