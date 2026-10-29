import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferenceHandlerPlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { env } from "@/lib/env";
import { errorDetails, logError, logInfo } from "@/lib/log";
import { createContext } from "@/orpc/context";
import { router } from "@/orpc/router";

/**
 * The public REST surface, plus its own documentation.
 *
 * This is a catch-all under /api, but Next resolves literal segments first, so
 * /api/auth/* and /api/rpc/* keep their dedicated handlers. Anything not
 * matched by a procedure falls through to a 404 here.
 *
 * Serving the spec next to the API is a contest deliverable: /api/docs is the
 * browsable reference and /api/spec.json the machine-readable OpenAPI document.
 */
const converters = [new ZodToJsonSchemaConverter()];
const generator = new OpenAPIGenerator({ converters });

const handler = new OpenAPIHandler(router, {
  interceptors: [
    onError((error, options) => {
      logError("api.failed", {
        requestId: options.context.requestId,
        ...errorDetails(error),
      });
    }),
  ],
  plugins: [
    // Query and path values arrive as strings; this converts them to what the
    // input schema asks for, but only where the conversion is lossless.
    new SmartCoercionHandlerPlugin({ converters }),
    new OpenAPIReferenceHandlerPlugin({
      docsPath: "/docs",
      specPath: "/spec.json",
      docsTitle: "Ruta Cibao API",
      // A function, not a literal: reading APP_URL at module scope would pull
      // the environment in during `next build`, which has none.
      spec: () =>
        generator.generate(router, {
          base: {
            info: {
              title: "Ruta Cibao API",
              version: "0.1.0",
              description:
                "Public API for the Ruta Cibao civic platform (Santiago Rodriguez, Dominican Republic).",
            },
            servers: [{ url: `${env.APP_URL}/api` }],
          },
        }),
    }),
  ],
});

async function handle(request: Request) {
  const started = performance.now();
  const { response } = await handler.handle(request, {
    prefix: "/api",
    context: createContext(request),
  });

  if (!response) return new Response("Not found", { status: 404 });

  logInfo("api.request", {
    requestId: request.headers.get("x-request-id") ?? "unknown",
    method: request.method,
    path: new URL(request.url).pathname,
    status: response.status,
    ms: Math.round(performance.now() - started),
  });
  if (new URL(request.url).pathname === "/api/offline/manifest") {
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
