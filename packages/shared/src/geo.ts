/**
 * Where the map starts and the product's province sits within the world.
 *
 * Framework-agnostic on purpose: a React Native build reads the same numbers.
 */

/** The centre of `CIBAO_BOUNDS`, for renderers that take a point and a zoom. */
export const REGION_CENTER = { longitude: -70.95, latitude: 19.45 } as const;

/** Santiago Rodríguez, framed so all three municipalities are on screen. */
export const PROVINCE_CENTER = { longitude: -71.3, latitude: 19.45 } as const;

export const DEFAULT_ZOOM = 8.8;

/** `[west, south, east, north]`, the order MapLibre expects. */
export type Bounds = [number, number, number, number];

/**
 * The Dominican Republic extent used to cut the inverse province mask returned
 * by the boundaries API. It is not a camera constraint: the self-hosted
 * basemap carries the whole world at low zoom.
 */
export const COUNTRY_BOUNDS: Bounds = [-71.92, 16.8, -67.8, 21.0];

/**
 * Where the map opens: the Cibao, framed so the region reads before the
 * province does.
 *
 * The platform is for Santiago Rodríguez, but opening on three municipalities
 * and nothing else gives no sense of where they are. Starting on the region
 * places them — the valley, Santiago to the east, the Cordillera to the
 * south — and one gesture closes in on the province itself.
 */
export const CIBAO_BOUNDS: Bounds = [-71.9, 18.95, -69.85, 19.95];

/**
 * The province, as a box drawn around its real polygons.
 *
 * Measured from the OpenStreetMap administrative relations used by the
 * basemap, rather than estimated. The old estimate reached 25 km into Valverde
 * on the east and cut the western edge of Sabaneta off on the west, which is
 * how a citizen standing on Dominican ground near the border was told they
 * were outside the province.
 *
 * Used for framing and for the cheap first pass on a submitted coordinate. The
 * authority is `ST_Contains` against the polygons themselves; a box cannot
 * describe a border that follows a river.
 */
export const PROVINCE_BOUNDS: Bounds = [-71.5197, 19.1684, -71.072, 19.5699];

/** Provincial bounds with a small margin (~2 km) for offline snapshot coverage. */
export const OFFLINE_PROVINCE_BOUNDS: Bounds = [-71.54, 19.15, -71.05, 19.59];

/**
 * Close enough to tell one street from the next.
 *
 * Two things read it and they have to agree: the map only draws roads as
 * tappable bands at or above this, and the crosshair's card only says "toca una
 * calle" at or above this. Drifting apart would mean telling somebody to tap
 * something the map had decided not to draw.
 */
export const STREET_ZOOM = 13;

/**
 * Close enough for place names to become compact map tags.
 *
 * Street geometry is useful at z13, but labels still collide with reports,
 * routes and each other there. At z15 the pins have enough screen space for a
 * greedy collision pass to expose names without turning the map into a list.
 * Every renderer reads this threshold so the hierarchy stays consistent.
 */
export const PLACE_LABEL_ZOOM = 15;

export const MIN_ZOOM = 1.5;
export const MAX_ZOOM = 19;

/** Whether a coordinate may be submitted as a new place. */
export function isSubmittable(position: { lng: number; lat: number }): boolean {
  const [west, south, east, north] = PROVINCE_BOUNDS;
  return (
    position.lng >= west &&
    position.lng <= east &&
    position.lat >= south &&
    position.lat <= north
  );
}

/** Tile source for the citizen places layer. */
export const PLACES_TILE_URL = "/api/tiles/places/{z}/{x}/{y}";
export const PLACES_SOURCE_ID = "ruta-places";
export const PLACES_SOURCE_LAYER = "places";
export const CLUSTERS_SOURCE_LAYER = "clusters";

/** Must match `CLUSTER_MAX_ZOOM` in `@/lib/tiles`: below it, tiles carry clusters. */
export const CLUSTER_MAX_ZOOM = 12;
