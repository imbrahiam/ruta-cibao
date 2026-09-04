/**
 * Where the map starts and what it is allowed to show.
 *
 * Framework-agnostic on purpose: a React Native build reads the same numbers.
 */

/**
 * The Cibao, framed so the region reads before the province does.
 *
 * The platform is for Santiago Rodríguez, but opening on three municipalities
 * and nothing else gives no sense of where they are. Starting on the region
 * places them — the valley, Santiago to the east, the Cordillera to the
 * south — and one gesture closes in on the province itself.
 */
export const REGION_CENTER = { longitude: -70.9, latitude: 19.45 } as const;

/** Santiago Rodríguez, framed so all three municipalities are on screen. */
export const PROVINCE_CENTER = { longitude: -71.3, latitude: 19.45 } as const;

export const DEFAULT_ZOOM = 8.6;

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

export const MIN_ZOOM = 7.5;
export const MAX_ZOOM = 18;

/** Tile source for the citizen places layer. */
export const PLACES_TILE_URL = "/api/tiles/places/{z}/{x}/{y}";
export const PLACES_SOURCE_ID = "ruta-places";
export const PLACES_SOURCE_LAYER = "places";
export const CLUSTERS_SOURCE_LAYER = "clusters";

/** Must match `CLUSTER_MAX_ZOOM` in `@/lib/tiles`: below it, tiles carry clusters. */
export const CLUSTER_MAX_ZOOM = 12;
