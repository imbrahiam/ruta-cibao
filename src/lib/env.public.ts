import { z } from "zod";

/**
 * Environment values that are safe to ship to the browser.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so each one has to
 * be written out literally — a computed lookup would come back undefined.
 */
const optional = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),

  /**
   * Basemap, in order of preference: a self-hosted PMTiles file, then MapTiler,
   * then neither. With neither, the citizen layer still renders on a clean
   * ground — which is what a machine with no keys and no signal gets, and it is
   * a usable map rather than an error.
   *
   * The MapTiler key is public by design; it is restricted by domain on their
   * side, the way every browser map key is.
   */
  NEXT_PUBLIC_BASEMAP_PMTILES_URL: optional,
  NEXT_PUBLIC_MAPTILER_KEY: optional,

  /**
   * Which map renderer to mount.
   *
   * Three exist side by side because they answer different questions and the
   * choice is not settled:
   *
   *   `google`    what is being tested now. Familiar, reliable, and billed per
   *               map load — a recurring cost the municipality would inherit,
   *               and its terms forbid caching tiles, so no offline map.
   *   `leaflet`   raster tiles from CARTO. No key, no bill, renders anywhere.
   *   `maplibre`  vector tiles from Postgres over a self-hosted PMTiles
   *               basemap. The offline and no-bill story, and the one that
   *               needs the most care to get right.
   *
   * None is deleted while this is undecided; switching is an env value.
   */
  NEXT_PUBLIC_MAP_RENDERER: z
    .enum(["google", "leaflet", "maplibre"])
    .default("google"),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: optional,

  /**
   * The VAPID public key, which is public by definition — it is what a browser
   * signs its subscription against, and the private half never leaves the
   * server.
   *
   * Absent means the account screen offers no push toggle at all, rather than
   * one that fails at the browser prompt. `VAPID_PUBLIC_KEY` on the server side
   * must be the same key: two halves of one pair, and a mismatch subscribes
   * devices the server cannot sign for.
   */
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  /** Enables Advanced Markers. Falls back to Google's documented dev id. */
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: optional,
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_BASEMAP_PMTILES_URL: process.env.NEXT_PUBLIC_BASEMAP_PMTILES_URL,
  NEXT_PUBLIC_MAPTILER_KEY: process.env.NEXT_PUBLIC_MAPTILER_KEY,
  NEXT_PUBLIC_MAP_RENDERER: process.env.NEXT_PUBLIC_MAP_RENDERER,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
  // Written out literally like the rest: Next inlines these at build time and
  // a computed lookup comes back undefined.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
});
