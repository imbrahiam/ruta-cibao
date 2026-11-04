import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logInfo } from "@/lib/log";

/**
 * Runs before every request.
 *
 * **Reject cross-site browser mutations.** Sessions are cookie-based, so a form
 * on someone else's site could POST here and the browser would attach the
 * cookie. Requiring the browser's own verdict and the Origin to match the host
 * on every unsafe method stops that before any handler runs. This is
 * belt-and-braces with oRPC v2 refusing GET on the RPC handler.
 *
 * The native app is not a browser: its requests carry no `Sec-Fetch-Site`
 * and no `Origin`, so they pass here and are authenticated by the session
 * cookie it holds in the device keychain.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The native app's schemes: the app sends `Origin: <scheme>://` on auth
 * requests. A scheme is not authentication — the session cookie still is — it only stops
 * this check from rejecting the app as a foreign web page.
 */
const NATIVE_ORIGINS = new Set([
  "rutacibao://",
  "rutacibao-preview://",
  ...(process.env.NODE_ENV === "production" ? [] : ["rutacibao-dev://"]),
]);

function isNativeOrigin(origin: string): boolean {
  return NATIVE_ORIGINS.has(origin);
}

/**
 * Whether an unsafe request came from this site.
 *
 * `Sec-Fetch-Site` is the browser's own verdict and cannot be forged by a page;
 * `Origin` is the older check. An `Origin` that does not parse — `null` from a
 * sandboxed frame is the common case — is treated as foreign.
 */
function isSameSite(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (isNativeOrigin(origin)) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** Headers every response carries. */
function withSecurityHeaders<T extends Response>(
  response: T,
  secure: boolean,
): T {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "SAMEORIGIN");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "permissions-policy",
    "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
  );
  if (secure) {
    response.headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains",
    );
  }
  return response;
}

function isSecure(request: NextRequest): boolean {
  return (
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:"
  );
}

/**
 * Every request gets an id before any handler runs.
 *
 * The id is generated here rather than accepted from the client: a header the
 * caller controls is a log-injection vector, and correlating two requests that
 * chose the same id is worth less than the risk. It is forwarded to the route
 * and echoed on the response, so a user report ("it failed at 14:02") and a
 * log line can be matched without guessing.
 */
export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const secure = isSecure(request);

  if (!SAFE_METHODS.has(request.method) && !isSameSite(request)) {
    logInfo("request.rejected", {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      reason: "cross_site",
    });
    const response = NextResponse.json(
      { error: "cross-origin request rejected" },
      { status: 403 },
    );
    response.headers.set("x-request-id", requestId);
    return withSecurityHeaders(response, secure);
  }

  logInfo("request.start", {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
  });

  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  return withSecurityHeaders(response, secure);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
