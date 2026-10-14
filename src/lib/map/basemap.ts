/**
 * Online raster fallback. The browser honours OpenStreetMap's cache headers;
 * these tiles are never prefetched or offered as an offline download.
 * Deployments can supply their own raster service through public env.
 */
export const RASTER_BASEMAP = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
} as const;
