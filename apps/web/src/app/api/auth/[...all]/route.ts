import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { errorDetails, logError } from "@/lib/log";

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
/**
 * Endpoints Better Auth mounts that this app never calls. There are no
 * passwords, so the reset flows only mint codes nobody asked for (by email
 * with no rate limit); `update-user` would let anyone set an unmoderated
 * avatar URL that every viewer's browser then fetches.
 */
const UNUSED_PATHS = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/sign-in/phone-number",
  "/request-password-reset",
  "/reset-password",
  "/change-password",
  "/set-password",
  "/verify-password",
  "/forget-password/email-otp",
  "/email-otp/request-password-reset",
  "/email-otp/reset-password",
  "/phone-number/request-password-reset",
  "/phone-number/reset-password",
  "/update-user",
  "/change-email",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
]);

function isRefusedPath(request: Request): boolean {
  let pathname: string;
  try {
    // Decoded and with repeated slashes collapsed, so `//admin` or `%2F`
    // spellings cannot route around the check.
    pathname = decodeURIComponent(new URL(request.url).pathname)
      .replace(/\/+/g, "/")
      .replace(/\/$/, "")
      .toLowerCase();
  } catch {
    return true;
  }
  if (/^\/api\/auth\/admin(\/|$)/.test(pathname)) return true;
  return UNUSED_PATHS.has(pathname.replace(/^\/api\/auth/, ""));
}

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Provider failures (Twilio, Resend, passkeys) are thrown out of Better Auth's
 * handlers rather than answered as a route result. Logging them here keeps one
 * structured line with the request id; Better Auth's own error never names the
 * destination.
 */
async function handle(request: Request, method: "GET" | "POST") {
  try {
    const handlers = route();
    return await handlers[method](request);
  } catch (error) {
    logError("auth.failed", {
      requestId: request.headers.get("x-request-id") ?? "unknown",
      method,
      path: new URL(request.url).pathname,
      ...errorDetails(error),
    });
    throw error;
  }
}

export const GET = (request: Request) =>
  isRefusedPath(request) ? notFound() : handle(request, "GET");
export const POST = (request: Request) =>
  isRefusedPath(request) ? notFound() : handle(request, "POST");
