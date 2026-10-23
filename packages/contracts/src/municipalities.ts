import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

export const municipalitySummary = z.object({
  id: z.string(),
  name: z.string(),
  center: z.object({ lng: z.number(), lat: z.number() }).nullable(),
});

export const municipalitiesContract = {
  /** Public: the onboarding form needs this before anyone has signed in. */
  list: oc
    .meta(
      openapi({
        method: "GET",
        path: "/municipalities",
        summary: "Municipalities of the province",
      }),
    )
    .output(z.array(municipalitySummary)),
};
