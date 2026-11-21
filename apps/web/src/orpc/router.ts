import { impl } from "./base";
import { businessesRouter } from "./routers/businesses";
import { catalogRouter } from "./routers/catalog";
import { commentsRouter } from "./routers/comments";
import { consultationsRouter } from "./routers/consultations";
import { directionsRouter } from "./routers/directions";
import { meRouter } from "./routers/me";
import { moderationRouter } from "./routers/moderation";
import { municipalitiesRouter } from "./routers/municipalities";
import { notificationsRouter } from "./routers/notifications";
import { offlineRouter } from "./routers/offline";
import { passportRouter } from "./routers/passport";
import { placesRouter } from "./routers/places";
import { reportsRouter } from "./routers/reports";
import { reputationRouter } from "./routers/reputation";
import { routesRouter } from "./routers/routes";
import { safetyRouter } from "./routers/safety";
import { staffRouter } from "./routers/staff";
import { trafficRouter } from "./routers/traffic";

/**
 * Root router: the server's implementation of `@ruta/contracts`.
 *
 * `impl.router` checks every procedure against the contract, so the typed
 * clients, the OpenAPI document and the handlers cannot disagree.
 */
export const router = impl.router({
  health: impl.health.handler(() => ({
    status: "ok" as const,
    time: new Date().toISOString(),
  })),

  me: meRouter,
  municipalities: municipalitiesRouter,
  moderation: moderationRouter,
  notifications: notificationsRouter,
  offline: offlineRouter,
  places: placesRouter,
  passport: passportRouter,
  reputation: reputationRouter,
  traffic: trafficRouter,
  consultations: consultationsRouter,
  comments: commentsRouter,
  directions: directionsRouter,
  businesses: businessesRouter,
  reports: reportsRouter,
  catalog: catalogRouter,
  routes: routesRouter,
  safety: safetyRouter,
  staff: staffRouter,
});
