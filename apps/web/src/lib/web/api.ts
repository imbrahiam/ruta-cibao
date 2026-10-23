"use client";

import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createApiClient } from "@ruta/contracts/client";

/**
 * The typed browser client for the staff screens.
 *
 * Same origin as the page, so the session cookie rides along without any
 * header plumbing. The module is also evaluated while server-rendering the
 * client components, where no request is made, so the origin has a harmless
 * stand-in there.
 */
export const api = createApiClient({
  origin:
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
});

/** Query and mutation options derived from the contract, for TanStack Query. */
export const orpc = createTanstackQueryUtils(api);
