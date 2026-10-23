import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import type { Contract } from "./index";

export type ApiClient = ContractRouterClient<Contract>;

export type ApiClientOptions = {
  /** Server origin, e.g. `https://rutacibao.do` or `http://192.168.1.20:3000`. */
  origin: string;
  /** Override for platforms whose fetch needs replacing (e.g. `expo/fetch`). */
  fetch?: typeof globalThis.fetch;
  /**
   * Headers added to every call, resolved per request: the native app passes
   * its session `Cookie` here, and queued mutations `x-expected-user-id`.
   */
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
};

/**
 * A typed client for `/api/rpc`.
 *
 * The RPC handler refuses GET, so every call is a POST; nothing here enables
 * GET requests.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const customFetch = options.fetch;
  const link = new RPCLink({
    origin: options.origin,
    url: "/api/rpc",
    headers: async () => (options.headers ? await options.headers() : {}),
    ...(customFetch
      ? { fetch: (url: string, init: RequestInit) => customFetch(url, init) }
      : {}),
  });
  return createORPCClient(link);
}
