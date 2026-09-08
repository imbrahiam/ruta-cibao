"use client";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createRouterUtils } from "@orpc/tanstack-query";
import type { AppRouter } from "@/orpc/router";

/**
 * The typed browser client.
 *
 * Same origin, so the link needs only the prefix the RPC handler is mounted at.
 * `AppRouter` is imported as a type, so none of the server router's code — its
 * database access, its permission checks — is reachable from the bundle.
 */
type ClientContext = { expectedUserId?: string };
const link = new RPCLink<ClientContext>({
  url: "/api/rpc",
  headers: ({ context }) =>
    context.expectedUserId
      ? { "x-expected-user-id": context.expectedUserId }
      : {},
});

export const client: RouterClient<AppRouter, ClientContext> =
  createORPCClient(link);

/** Query and mutation options derived from the router, for TanStack Query. */
export const orpc = createRouterUtils(client);
