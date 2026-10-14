import type { Bounds } from "@/lib/map/config";

/**
 * A flat drawing frame for the province.
 *
 * The landing draws the three municipalities as a plain SVG rather than a map,
 * so it needs a projection — and at this size (forty kilometres across) the
 * simplest honest one is enough: longitude shrunk by the cosine of the middle
 * latitude, latitude flipped so north is up. That keeps the shapes the right
 * proportions without pulling a projection library into a page that has to
 * load on 3G.
 *
 * `scale` is "viewBox units per degree of latitude"; the database applies the
 * same numbers (`ST_Translate` then `ST_Scale`) to turn the polygons into path
 * data, and `project` places the points drawn over them.
 */
export type TerritoryFrame = {
  west: number;
  north: number;
  /** Units per degree of longitude. */
  scaleX: number;
  /** Units per degree of latitude. */
  scaleY: number;
  width: number;
  height: number;
};

export function territoryFrame(bounds: Bounds, width: number): TerritoryFrame {
  const [west, south, east, north] = bounds;
  const middle = ((south + north) / 2) * (Math.PI / 180);
  const aspect = Math.cos(middle);
  const scaleY = width / ((east - west) * aspect);
  const scaleX = scaleY * aspect;
  return {
    west,
    north,
    scaleX,
    scaleY,
    width,
    height: (north - south) * scaleY,
  };
}

/** A longitude/latitude pair, in viewBox units. */
export function project(
  frame: TerritoryFrame,
  longitude: number,
  latitude: number,
): { x: number; y: number } {
  return {
    x: round((longitude - frame.west) * frame.scaleX),
    y: round((frame.north - latitude) * frame.scaleY),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
