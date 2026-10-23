import { openapi } from "@orpc/openapi";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { municipalities } from "@/db/schema";
import { pub } from "../base";

/** Public: the onboarding form needs this before anyone has signed in. */
export const municipalitiesRouter = {
  list: pub
    .meta(
      openapi({
        method: "GET",
        path: "/municipalities",
        summary: "Municipalities of the province",
      }),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          center: z.object({ lng: z.number(), lat: z.number() }).nullable(),
        }),
      ),
    )
    .handler(async ({ context }) => {
      const rows = await context.db
        .select({
          id: municipalities.id,
          name: municipalities.name,
          center: municipalities.center,
        })
        .from(municipalities)
        .orderBy(asc(municipalities.name));

      return rows.map((municipality) => ({
        id: municipality.id,
        name: municipality.name,
        center: municipality.center
          ? {
              lng: municipality.center.x,
              lat: municipality.center.y,
            }
          : null,
      }));
    }),
};
