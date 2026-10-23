import { openapi } from "@orpc/openapi";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { categories } from "@/db/schema";
import {
  browseRoutesInput,
  decideRouteInput,
  routeOutput,
  submitRouteInput,
} from "@/modules/routes/contracts";
import {
  communityFeature,
  mapFeatures,
  mapFeaturesInput,
} from "@/modules/routes/map-features";
import {
  browseRoutes,
  decideRoute,
  routeDetail,
  submitRoute,
} from "@/modules/routes/service";
import { memberProcedure, moderatorProcedure, pub } from "../base";

export const routesRouter = {
  map: pub
    .meta(openapi({ method: "GET", path: "/map/community" }))
    .input(mapFeaturesInput)
    .output(
      z.object({ features: z.array(communityFeature), truncated: z.boolean() }),
    )
    .handler(({ context, input }) => mapFeatures(context.db, input)),
  categories: pub
    .meta(openapi({ method: "GET", path: "/routes/categories" }))
    .handler(({ context }) =>
      context.db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(and(eq(categories.kind, "route"), eq(categories.isActive, true)))
        .orderBy(categories.sortOrder),
    ),
  browse: pub
    .meta(openapi({ method: "GET", path: "/routes" }))
    .input(browseRoutesInput)
    .output(z.object({ items: z.array(routeOutput), total: z.number() }))
    .handler(async ({ context, input }) =>
      browseRoutes(context.db, await context.getViewer(), input),
    ),
  detail: pub
    .meta(openapi({ method: "GET", path: "/routes/{id}" }))
    .input(z.object({ id: z.uuid() }))
    .output(routeOutput)
    .handler(async ({ context, input }) =>
      routeDetail(await context.getViewer(), input.id),
    ),
  submit: memberProcedure
    .meta(openapi({ method: "POST", path: "/routes", successStatus: 201 }))
    .input(submitRouteInput)
    .output(z.object({ id: z.uuid(), status: z.literal("pending") }))
    .handler(({ context, input }) => submitRoute(context.viewer, input)),
  decide: moderatorProcedure
    .meta(openapi({ method: "POST", path: "/routes/{id}/decision" }))
    .input(decideRouteInput)
    .output(z.object({ status: z.enum(["published", "rejected"]) }))
    .handler(({ context, input }) => decideRoute(context.viewer, input)),
};
