/**
 * Where the map starts and what it is allowed to show.
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
 * How far out the map is allowed to go: the country, and nothing else.
 *
 * The west edge sits just past the Dominican side of the border rather than at
 * a round number, so the strip of Haiti on screen is as thin as a border that
 * is not a straight line allows — that edge never moves. East, north and south
 * are the coasts plus a margin for Isla Beata and the Siete Hermanos cays,
 * with room to spare over the water — generous to the north, where there is
 * nothing but sea: placing a point on a beach or a cay means panning out over
 * the water first, and a bound that ends at the shoreline makes that fight
 * the map instead of the zoom.
 *
 * Google is told to keep the whole viewport inside this, not just the centre,
 * which is what stops a zoom-out from framing the neighbouring country.
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
 * Measured from the geoBoundaries import rather than estimated — the estimate
 * that stood here reached 25 km into Valverde on the east and cut the western
 * edge of Sabaneta off on the west, which is how a citizen standing on
 * Dominican ground near the border was told they were outside the province.
 *
 * Used for framing and for the cheap first pass on a submitted coordinate. The
 * authority is `ST_Contains` against the polygons themselves; a box cannot
 * describe a border that follows a river.
 */
export const PROVINCE_BOUNDS: Bounds = [-71.5075, 19.162, -71.0631, 19.5624];

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
 * Close enough for the places to say their own names.
 *
 * Below this the pins are a constellation — the point of them is where things
 * are relative to each other, and fifty names over three municipalities is a
 * wall of text with a map behind it. Above it there is ground between one pin
 * and the next, which is the room a label needs. Every renderer reads this, so
 * the map does not change its mind about when a name appears depending on which
 * one is drawing it.
 *
 * The same threshold as `STREET_ZOOM`, and for the same reason: the zoom at
 * which one street is distinguishable from the next is the zoom at which a
 * label has somewhere to sit.
 */
export const PLACE_LABEL_ZOOM = STREET_ZOOM;

export const MIN_ZOOM = 7.2;
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
