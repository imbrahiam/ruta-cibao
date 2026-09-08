import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { pub } from "./base";
import { businessesRouter } from "./routers/businesses";
import { catalogRouter } from "./routers/catalog";
import { citizenRouter } from "./routers/citizen";
import { consultationsRouter } from "./routers/consultations";
import { meRouter } from "./routers/me";
import { moderationRouter } from "./routers/moderation";
import { municipalitiesRouter } from "./routers/municipalities";
import { notificationsRouter } from "./routers/notifications";
import { placesRouter } from "./routers/places";
import { reportsRouter } from "./routers/reports";
import { routesRouter } from "./routers/routes";
import { trafficRouter } from "./routers/traffic";

/**
 * Root router. The shape of this object is what the typed client and the
 * OpenAPI document are both generated from, so a procedure cannot exist in one
 * and be missing from the other.
 *
 * HTTP routing lives in `openapi()` metadata — in oRPC v2 the builder has no
 * `.route()` method.
 */
export const router = {
  health: pub
    .meta(
      openapi({ method: "GET", path: "/health", summary: "Liveness probe" }),
    )
    .output(z.object({ status: z.literal("ok"), time: z.iso.datetime() }))
    .handler(() => ({ status: "ok" as const, time: new Date().toISOString() })),

  me: meRouter,
  municipalities: municipalitiesRouter,
  citizen: citizenRouter,
  moderation: moderationRouter,
  notifications: notificationsRouter,
  places: placesRouter,
  traffic: trafficRouter,
  consultations: consultationsRouter,
  businesses: businessesRouter,
  reports: reportsRouter,
  catalog: catalogRouter,
  routes: routesRouter,
};

export type AppRouter = typeof router;
