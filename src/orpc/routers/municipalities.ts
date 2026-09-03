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
    .output(z.array(z.object({ id: z.string(), name: z.string() })))
    .handler(async ({ context }) =>
      context.db
        .select({ id: municipalities.id, name: municipalities.name })
        .from(municipalities)
        .orderBy(asc(municipalities.name)),
    ),
};
