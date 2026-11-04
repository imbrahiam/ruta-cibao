import type {
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from "@orpc/contract";
import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { businessesContract } from "./businesses";
import { catalogContract } from "./catalog";
import { commentsContract } from "./comments";
import { consultationsContract } from "./consultations";
import { directionsContract } from "./directions";
import { meContract } from "./me";
import { moderationContract } from "./moderation";
import { municipalitiesContract } from "./municipalities";
import { notificationsContract } from "./notifications";
import { offlineContract } from "./offline";
import { passportContract } from "./passport";
import { placesContract } from "./places";
import { reportsContract } from "./reports";
import { routesContract } from "./routes";
import { safetyContract } from "./safety";
import { staffContract } from "./staff";
import { trafficContract } from "./traffic";

/**
 * The Ruta Cibao API, contract first.
 *
 * One authoritative description for the native app, the web, server-side
 * clients and the worker. The server implements it with `implement(contract)`;
 * clients get their types from it. HTTP routes for the OpenAPI surface live in
 * each procedure's `openapi()` metadata.
 */
export const contract = {
  health: oc
    .meta(
      openapi({ method: "GET", path: "/health", summary: "Liveness probe" }),
    )
    .output(z.object({ status: z.literal("ok"), time: z.iso.datetime() })),

  me: meContract,
  municipalities: municipalitiesContract,
  moderation: moderationContract,
  notifications: notificationsContract,
  offline: offlineContract,
  places: placesContract,
  passport: passportContract,
  traffic: trafficContract,
  consultations: consultationsContract,
  comments: commentsContract,
  directions: directionsContract,
  businesses: businessesContract,
  reports: reportsContract,
  catalog: catalogContract,
  routes: routesContract,
  safety: safetyContract,
  staff: staffContract,
};

export type Contract = typeof contract;
export type ApiInputs = InferContractRouterInputs<Contract>;
export type ApiOutputs = InferContractRouterOutputs<Contract>;

export * from "./businesses";
export * from "./catalog";
export * from "./comments";
export * from "./consultations";
export * from "./directions";
export * from "./me";
export * from "./moderation";
export * from "./municipalities";
export * from "./notifications";
export * from "./offline";
export * from "./passport";
export * from "./places";
export * from "./reports";
export * from "./routes";
export * from "./safety";
export * from "./staff";
export * from "./traffic";
