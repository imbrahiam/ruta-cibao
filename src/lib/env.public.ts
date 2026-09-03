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
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_BASEMAP_PMTILES_URL: process.env.NEXT_PUBLIC_BASEMAP_PMTILES_URL,
  NEXT_PUBLIC_MAPTILER_KEY: process.env.NEXT_PUBLIC_MAPTILER_KEY,
});
