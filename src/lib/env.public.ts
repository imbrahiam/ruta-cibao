/**
 * Environment values that are safe to ship to the browser.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so each one has to
 * be written out literally — a computed lookup would come back undefined.
 */
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
