/**
 * The raster basemap.
 *
 * CARTO Positron: light grey ground, white roads, sparse labels — the quiet
 * backdrop this map wants, and already close to the app's own greys without
 * restyling anything. Free for OpenStreetMap-derived use with attribution,
 * which is shown on the map.
 *
 * Configurable, so a municipality can point at its own tile server later
 * without a code change.
 *
 * Plain data, no DOM: React Native reads the same URL template.
 */
export const RASTER_BASEMAP = {
  url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19,
} as const;
