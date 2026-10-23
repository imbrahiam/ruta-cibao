import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
 * The native app's schemes. Better Auth's Expo plugin turns the client's
 * `expo-origin` header into `Origin`, so these arrive on auth requests. A
 * scheme is not authentication — the session cookie still is — it only stops
 * this check from rejecting the app as a foreign web page.
 */
const NATIVE_ORIGINS = new Set([
  "rutacibao://",
  "rutacibao-preview://",
  ...(process.env.NODE_ENV === "production" ? [] : ["rutacibao-dev://"]),
]);

function isNativeOrigin(origin: string): boolean {
  if (NATIVE_ORIGINS.has(origin)) return true;
  // Expo Go reports `exp://<host>:<port>`; development only.
  return process.env.NODE_ENV !== "production" && origin.startsWith("exp://");
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
function withSecurityHeaders<T extends Response>(response: T): T {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "SAMEORIGIN");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "permissions-policy",
    "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
  );
  return response;
}

export function proxy(request: NextRequest) {
  if (!SAFE_METHODS.has(request.method) && !isSameSite(request)) {
    return NextResponse.json(
      { error: "cross-origin request rejected" },
      { status: 403 },
    );
  }
  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
