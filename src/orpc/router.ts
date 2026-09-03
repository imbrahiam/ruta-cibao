import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { pub } from "./base";

/**
 * Root router. Feature routers (places, routes, traffic, consultations,
 * reports) get mounted here as they land; the shape of this object is what the
 * typed client and the OpenAPI document are both generated from.
 *
 * HTTP routing lives in `openapi()` metadata — in oRPC v2 the builder no longer
 * has a `.route()` method.
 */
export const router = {
  health: pub
    .meta(
      openapi({ method: "GET", path: "/health", summary: "Liveness probe" }),
    )
    .output(z.object({ status: z.literal("ok"), time: z.iso.datetime() }))
    .handler(() => ({ status: "ok" as const, time: new Date().toISOString() })),
};

export type AppRouter = typeof router;
