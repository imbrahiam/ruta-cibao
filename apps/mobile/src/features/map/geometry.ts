import type { MunicipalFeature } from "@ruta/shared/boundaries";
import type { LatLng, Region } from "react-native-maps";

export type PolygonRings = { coordinates: LatLng[]; holes: LatLng[][] };

const toLatLng = (position: number[]): LatLng => ({
  longitude: position[0] ?? 0,
  latitude: position[1] ?? 0,
});

/** GeoJSON Polygon/MultiPolygon to the outer ring + holes the native map wants. */
export function polygonRings(
  geometry: MunicipalFeature["geometry"],
): PolygonRings[] {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map(([outer = [], ...holes]) => ({
    coordinates: outer.map(toLatLng),
    holes: holes.map((ring) => ring.map(toLatLng)),
  }));
}

export function lineCoordinates(
  path: { lng: number; lat: number }[],
): LatLng[] {
  return path.map((point) => ({ longitude: point.lng, latitude: point.lat }));
}

/**
 * Web-mercator zoom shown by a region on a view `width` points wide: the world
 * is 256·2^z points around at zoom z.
 */
export function zoomForRegion(region: Region, width: number): number {
  const delta = Math.max(region.longitudeDelta, 1e-6);
  return Math.log2((360 * width) / (256 * delta));
}

/** `[west, south, east, north]` of a region, for clustering what is on screen. */
export function regionBounds(region: Region): [number, number, number, number] {
  return [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ];
}

export function boundsRegion([west, south, east, north]: readonly [
  number,
  number,
  number,
  number,
]): Region {
  return {
    longitude: (west + east) / 2,
    latitude: (south + north) / 2,
    longitudeDelta: east - west,
    latitudeDelta: north - south,
  };
}
