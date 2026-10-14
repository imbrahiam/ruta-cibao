import type { Feature, FeatureCollection, Point, Polygon } from "geojson";

/**
 * The "you are here" dot, as data every renderer can draw.
 *
 * A dot alone overstates what the phone knows: a fix 300 m wide drawn as a
 * pin-sharp point is how people end up waiting on the wrong corner. The
 * accuracy ring is the convention Google and Apple use for that, and it only
 * appears when it would be larger than the dot itself.
 */
export type LocationFix = { lng: number; lat: number; accuracyMeters?: number };

const EARTH_RADIUS_M = 6_378_137;

/** A circle of `radius` metres, as a polygon of `steps` points. */
export function circlePolygon(
  center: { lng: number; lat: number },
  radius: number,
  steps = 48,
): Polygon {
  const latRad = (center.lat * Math.PI) / 180;
  const ring: [number, number][] = [];
  for (let step = 0; step <= steps; step++) {
    const angle = (step / steps) * 2 * Math.PI;
    const dLat = (radius * Math.sin(angle)) / EARTH_RADIUS_M;
    const dLng =
      (radius * Math.cos(angle)) / (EARTH_RADIUS_M * Math.cos(latRad));
    ring.push([
      center.lng + (dLng * 180) / Math.PI,
      center.lat + (dLat * 180) / Math.PI,
    ]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

/** Below this the ring hides behind the dot anyway. */
export const MIN_ACCURACY_RING_M = 15;

export function locationFeatures(
  fix: LocationFix,
): FeatureCollection<Point | Polygon, { part: "accuracy" | "dot" }> {
  const features: Feature<Point | Polygon, { part: "accuracy" | "dot" }>[] = [];
  if (fix.accuracyMeters && fix.accuracyMeters > MIN_ACCURACY_RING_M) {
    features.push({
      type: "Feature",
      properties: { part: "accuracy" },
      geometry: circlePolygon(fix, fix.accuracyMeters),
    });
  }
  features.push({
    type: "Feature",
    properties: { part: "dot" },
    geometry: { type: "Point", coordinates: [fix.lng, fix.lat] },
  });
  return { type: "FeatureCollection", features };
}
