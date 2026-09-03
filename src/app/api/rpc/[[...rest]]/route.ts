import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { createContext } from "@/orpc/context";
import { router } from "@/orpc/router";

/**
 * The RPC surface: compact protocol, consumed only by this app's typed client.
 * Third parties use the OpenAPI surface under /api instead.
 *
 * No GET export. oRPC v2 rejects GET on this handler by default, because a
 * procedure reachable by GET is reachable from a cross-site <img> or <script>
 * tag. Enabling it would mean taking on CSRF protection for no benefit here.
 */
const handler = new RPCHandler(router, {
  interceptors: [onError((error) => console.error(error))],
});

async function handle(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: "/api/rpc",
    context: createContext(request),
  });

  return response ?? new Response("Not found", { status: 404 });
}

export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
