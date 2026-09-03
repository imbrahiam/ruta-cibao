/**
 * Where the map starts and what it is allowed to show.
 *
 * Framework-agnostic on purpose: a React Native build reads the same numbers.
 */

/** Santiago Rodríguez, framed so all three municipalities are on screen. */
export const PROVINCE_CENTER = { longitude: -71.3, latitude: 19.45 } as const;

export const DEFAULT_ZOOM = 10.5;

/**
 * Panning is bounded to the province and a margin around it.
 *
 * This is a provincial platform: letting someone scroll to Santo Domingo and
 * find an empty map is a worse experience than gently refusing to go there.
 */
/** `[west, south, east, north]`, the order MapLibre expects. */
export const PROVINCE_BOUNDS: [number, number, number, number] = [
  -71.75, 19.15, -70.85, 19.75,
];

export const MIN_ZOOM = 8;
export const MAX_ZOOM = 18;

/** Tile source for the citizen places layer. */
export const PLACES_TILE_URL = "/api/tiles/places/{z}/{x}/{y}";
export const PLACES_SOURCE_ID = "ruta-places";
export const PLACES_SOURCE_LAYER = "places";
export const CLUSTERS_SOURCE_LAYER = "clusters";

/** Must match `CLUSTER_MAX_ZOOM` in `@/lib/tiles`: below it, tiles carry clusters. */
export const CLUSTER_MAX_ZOOM = 12;
