import { z } from "zod";

/**
 * Environment values that are safe to ship to the browser.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so each one has to
 * be written out literally; a computed lookup would come back undefined.
 */
const optional = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),

  /**
   * The self-hosted basemap: one PMTiles archive read by range request, drawn
   * with the app's own style. `bun run basemap` cuts it.
   */
  NEXT_PUBLIC_BASEMAP_PMTILES_URL: optional,

  /**
   * The VAPID public key. Absent means the account screen offers no push
   * toggle at all, rather than one that fails at the browser prompt.
   */
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_BASEMAP_PMTILES_URL: process.env.NEXT_PUBLIC_BASEMAP_PMTILES_URL,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
});
