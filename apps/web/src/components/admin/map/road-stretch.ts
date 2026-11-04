import type { LatLng } from "./map-types";

/*
 * Geometry for drawing a stretch of road the way Google Maps highlights one:
 * a band exactly as wide as the street's own fill, so the colour covers the
 * carriageway to its edges and never spills over them.
 *
 * The basemap's fill width cannot be read back from the tiles and is not a
 * function of the road class (a "local" street alone is drawn 3, 6 or 8 px at
 * zoom 17), so the style does not leave it to Google: `mapStyle` gives every
 * road the same fill `weight` for the zoom, and the line here is that very
 * weight. Both read `ROAD_FILL_PX`, so they cannot drift apart.
 */

/**
 * Road fill width in CSS pixels per integer zoom, for every road class. About a
 * six-metre street where it is wide enough to see (zoom 17 and closer), and
 * the thinnest line that still reads as a street above that.
 */
export const ROAD_FILL_PX: Readonly<Record<number, number>> = {
  14: 3,
  15: 3,
  16: 4,
  17: 6,
  18: 11,
  19: 20,
  20: 32,
};

const FILL_ZOOM = { min: 14, max: 20 } as const;

/**
 * The fill weight the basemap is styled with at a zoom: whole pixels, since
 * the style API rounds them, and the same for the whole of an integer zoom.
 */
export function roadWeight(zoom: number): number {
  const level = clamp(Math.round(zoom), FILL_ZOOM.min, FILL_ZOOM.max);
  return ROAD_FILL_PX[level] ?? ROAD_FILL_PX[FILL_ZOOM.min] ?? 3;
}

/**
 * The road fill width on screen at a zoom, in CSS pixels. A raster map shows
 * the tiles of the nearest whole zoom scaled by the fraction left over (a
 * pinch, an animated zoom), so the fill scales the same way.
 */
export function roadFillPx(zoom: number): number {
  const level = Math.round(zoom);
  return roadWeight(level) * 2 ** (zoom - level);
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Chaikin corner cutting: every segment is replaced by two points at its
 * quarter and three-quarter marks, which turns an angular OSM polyline into a
 * smooth curve inside its own hull. The ends stay where they are so a stretch
 * still starts and stops where it was reported.
 *
 * This is the stand-in drawn before (or without) Google's road geometry.
 */
export function smoothPath(path: LatLng[], iterations = 2): LatLng[] {
  let current = path;
  for (let round = 0; round < iterations && current.length > 2; round += 1) {
    const last = current.length - 2;
    const next: LatLng[] = current.slice(0, 1);
    for (let index = 0; index <= last; index += 1) {
      const a = current[index];
      const b = current[index + 1];
      if (!a || !b) continue;
      // The first segment keeps its outer end, and so does the last.
      if (index > 0) {
        next.push({
          lat: a.lat * 0.75 + b.lat * 0.25,
          lng: a.lng * 0.75 + b.lng * 0.25,
        });
      }
      if (index < last) {
        next.push({
          lat: a.lat * 0.25 + b.lat * 0.75,
          lng: a.lng * 0.25 + b.lng * 0.75,
        });
      }
    }
    next.push(...current.slice(-1));
    current = next;
  }
  return current;
}

/** A short stable key for a path: equal geometry, equal key. */
export function pathKey(path: LatLng[]): string {
  let hash = 2166136261;
  for (const point of path) {
    const text = `${point.lat.toFixed(6)},${point.lng.toFixed(6)};`;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${path.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * The centre and integer zoom that show `points` filling about `fill` of the
 * smaller side of a `width`×`height` frame.
 *
 * Raster maps zoom in whole steps, so the stretch lands between roughly 45% and
 * 90% of the frame; the zoom is the largest that keeps it under 90%. Only
 * pixels of the frame enter the arithmetic, so a phone and a desktop frame the
 * same stretch the same way.
 */
export function framingFor(
  points: LatLng[],
  width: number,
  height: number,
  fill = 0.7,
): { center: LatLng; zoom: number } | null {
  if (points.length === 0 || width <= 0 || height <= 0) return null;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const point of points) {
    west = Math.min(west, point.lng);
    east = Math.max(east, point.lng);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
  }
  const mercatorY = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  };
  const spanX = Math.max((east - west) / 360, 1e-9);
  const spanY = Math.max(mercatorY(south) - mercatorY(north), 1e-9);
  // World size in pixels at zoom z is 256·2^z, so the zoom for a target size:
  const fit = Math.log2(
    Math.min((width * fill) / (256 * spanX), (height * fill) / (256 * spanY)),
  );
  const zoom = clamp(Math.floor(fit + Math.log2(0.9 / fill)), 3, 19);
  return {
    center: { lat: (south + north) / 2, lng: (west + east) / 2 },
    zoom,
  };
}
