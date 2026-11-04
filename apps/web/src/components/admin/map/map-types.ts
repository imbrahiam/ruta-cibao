import { pathMidpoint } from "@ruta/shared/road-geometry";

export type LatLng = { lat: number; lng: number };

/**
 * What a map draws. Three kinds, mirroring the phone app:
 *
 * - `place`: a category-coloured disc with its glyph.
 * - `traffic`: a report. Severity colour plus the category glyph at the
 *   report's point, and when it marks a stretch of road, that road drawn in
 *   the same colour over a casing. Cleared reports are dotted.
 * - `route`: a trail as a dashed line with a start (disc) and an end (square).
 */
export type MapItem =
  | {
      kind: "place";
      id: string;
      /** The accessible name: what this marker is. */
      label: string;
      lat: number;
      lng: number;
      icon: string;
      color: string;
    }
  | {
      kind: "traffic";
      id: string;
      label: string;
      lat: number;
      lng: number;
      icon: string;
      color: string;
      cleared: boolean;
      path: LatLng[] | null;
    }
  | {
      kind: "route";
      id: string;
      label: string;
      path: LatLng[];
    };

/** A neighbouring published place, drawn as a faint dot for orientation. */
export type ContextPoint = {
  id: string;
  lat: number;
  lng: number;
  name: string;
};

/** Every coordinate an item occupies, for fitting the view and the fallback. */
export function itemPoints(item: MapItem): LatLng[] {
  if (item.kind === "route") return item.path;
  if (item.kind === "traffic" && item.path) return item.path;
  return [{ lat: item.lat, lng: item.lng }];
}

/**
 * Where an item's marker sits: a stretch's is halfway along it, measured by
 * distance, so it is centred on the highlight whatever the shape of the road.
 */
export function itemMarkerPoint(item: MapItem): LatLng {
  if (item.kind === "traffic" && item.path && item.path.length > 1) {
    return pathMidpoint(item.path);
  }
  return itemAnchor(item);
}

/** The point an item is pinned at (a route's is its start). */
export function itemAnchor(item: MapItem): LatLng {
  if (item.kind === "route") {
    return item.path[0] ?? { lat: 0, lng: 0 };
  }
  return { lat: item.lat, lng: item.lng };
}
