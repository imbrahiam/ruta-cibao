import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

/** Deferred to the first request; see the note in `@/lib/auth`. */
let handler: ReturnType<typeof toNextJsHandler> | undefined;

function route() {
  handler ??= toNextJsHandler(getAuth());
  return handler;
}

/**
 * The Better Auth admin plugin is for audited, server-side use only. Its HTTP
 * endpoints would let a session with the plugin's admin flag ban users or
 * change roles without the application's scope checks and audit trail, so they
 * do not exist from the outside.
 */
function isAdminPluginPath(request: Request): boolean {
  let pathname: string;
  try {
    // Decoded and with repeated slashes collapsed, so `//admin` or `%2F`
    // spellings cannot route around the check.
    pathname = decodeURIComponent(new URL(request.url).pathname).replace(
      /\/+/g,
      "/",
    );
  } catch {
    return true;
  }
  return /^\/api\/auth\/admin(\/|$)/i.test(pathname);
}

const notFound = () => new Response("Not found", { status: 404 });

export const GET = (request: Request) =>
  isAdminPluginPath(request) ? notFound() : route().GET(request);
export const POST = (request: Request) =>
  isAdminPluginPath(request) ? notFound() : route().POST(request);
