import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { ApiInputs, ApiOutputs } from "@ruta/contracts";
import { createApiClient } from "@ruta/contracts/client";
import { authClient } from "./auth";
import { API_ORIGIN } from "./config";

/**
 * The typed Ruta Cibao API. Every call carries the session cookie from the
 * keychain; signed out, it carries nothing and public procedures still answer.
 */
export const api = createApiClient({
  origin: API_ORIGIN,
  headers: async (): Promise<Record<string, string>> => {
    const cookie = await authClient.getCookie();
    return cookie ? { cookie } : {};
  },
});

/** TanStack Query helpers: `orpc.places.detail.queryOptions({ input })`. */
export const orpc = createTanstackQueryUtils(api);

export type { ApiInputs, ApiOutputs };
