/**
 * Screen-space arithmetic on a settled viewport.
 *
 * Framework-agnostic on purpose, like `config.ts`: every renderer reports the
 * same `{ lng, lat, zoom, bounds }`, and the questions below are asked of that
 * report rather than of any one SDK's projection object.
 */
export type ViewportBounds = {
  west: number;
  east: number;
  south: number;
  north: number;
};

export type Viewport = {
  lng: number;
  lat: number;
  zoom: number;
  bounds?: ViewportBounds;
};

/**
 * Where the crosshair sits, as a fraction of the map's height from the top.
 *
 * Not the middle. The picker's card rides over the bottom of the map, and a
 * pin at dead centre sat on the card's top edge with the street it had chosen
 * shaded underneath the card — the one thing the person needed to see. Two
 * fifths down leaves the shading visible on a phone without pushing the pin
 * under the search row on a desktop.
 */
export const CROSSHAIR_FRACTION = 0.4;

/**
 * Ground distance covered by one CSS pixel at this latitude and zoom.
 *
 * Web Mercator with 256-pixel tiles, which is the convention every renderer
 * here reports its zoom in.
 */
export function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * Pixels the map must be displaced for a point to land under the crosshair
 * rather than at the viewport's centre. DOM convention: negative is up.
 */
export function crosshairOffsetPx(mapHeightPx: number): {
  x: number;
  y: number;
} {
  const up = Math.round(mapHeightPx * (0.5 - CROSSHAIR_FRACTION));
  return { x: 0, y: up === 0 ? 0 : -up };
}

function mercatorY(lat: number): number {
  const phi = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + phi / 2));
}

function mercatorLat(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

/**
 * The coordinate under a point a given fraction down the map's height, on the
 * vertical centre line.
 *
 * Interpolated in Mercator space between the viewport's north and south edges,
 * so it is exact regardless of which SDK drew the map or how it numbers its
 * zoom levels. Without bounds — the first frame, before the map has reported
 * any — the centre is the best answer available.
 */
export function pointAtHeightFraction(
  viewport: Viewport,
  fraction: number,
): { lng: number; lat: number } {
  const { bounds } = viewport;
  if (!bounds) return { lng: viewport.lng, lat: viewport.lat };

  const top = mercatorY(bounds.north);
  const bottom = mercatorY(bounds.south);
  return {
    lng: viewport.lng,
    lat: mercatorLat(top + (bottom - top) * fraction),
  };
}

/**
 * The centre a map must take for `target` to land `offset` pixels away from
 * the middle of the viewport, at this zoom. DOM convention: x right, y down.
 *
 * Worked out in Mercator world pixels at the *target* zoom rather than by
 * displacing the camera by pixels once it has arrived. A pixel is a different
 * distance on the ground at every zoom, so "zoom in, then shove the camera
 * 200 px north" applies the shove at whatever scale the map is still
 * rendering — which is how opening a place from the directory landed the map a
 * hundred kilometres from it.
 */
export function offsetCenter(
  target: { lng: number; lat: number },
  zoom: number,
  offset: { x: number; y: number },
): { lng: number; lat: number } {
  // 256-pixel tiles, the convention every renderer here numbers its zoom in.
  const world = 256 * 2 ** zoom;
  const x = ((target.lng + 180) / 360) * world - offset.x;
  const y = (0.5 - mercatorY(target.lat) / (2 * Math.PI)) * world - offset.y;

  return {
    lng: (x / world) * 360 - 180,
    lat: mercatorLat((0.5 - y / world) * 2 * Math.PI),
  };
}
