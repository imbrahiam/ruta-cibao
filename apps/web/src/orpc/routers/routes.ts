import { and, eq } from "drizzle-orm";
import { categories } from "@/db/schema";
import { mapFeatures } from "@/modules/routes/map-features";
import {
  browseRoutes,
  decideRoute,
  routeDetail,
  submitRoute,
} from "@/modules/routes/service";
import { impl, member, moderator } from "../base";

export const routesRouter = {
  map: impl.routes.map.handler(({ context, input }) =>
    mapFeatures(context.db, input),
  ),
  categories: impl.routes.categories.handler(({ context }) =>
    context.db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.kind, "route"), eq(categories.isActive, true)))
      .orderBy(categories.sortOrder),
  ),
  browse: impl.routes.browse.handler(async ({ context, input }) =>
    browseRoutes(context.db, await context.getViewer(), input),
  ),
  detail: impl.routes.detail.handler(async ({ context, input }) =>
    routeDetail(await context.getViewer(), input.id),
  ),
  submit: impl.routes.submit
    .use(member)
    .handler(({ context, input }) => submitRoute(context.viewer, input)),
  decide: impl.routes.decide
    .use(moderator)
    .handler(({ context, input }) => decideRoute(context.viewer, input)),
};
