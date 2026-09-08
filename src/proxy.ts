import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { appPath, routeAccess } from "@/modules/access/route-policy";

/**
 * Runs before every page and API request.
 *
 * Three jobs:
 *
 *  1. **Reject cross-site mutations.** Sessions are cookie-based, so a form on
 *     someone else's site could POST here and the browser would attach the
 *     cookie. Requiring Origin to match the host on every unsafe method stops
 *     that at the door, before any handler runs. This is belt-and-braces with
 *     oRPC v2 refusing GET on the RPC handler — together they mean no mutation
 *     is reachable from a cross-site page.
 *
 *  2. **Pre-filter protected pages.** A missing Better Auth cookie cannot be a
 *     valid member session, so those requests go straight to sign-in. The page
 *     still performs the authoritative database-backed check.
 *
 *  3. **Locale routing** for pages, via next-intl.
 *
 * Note the ordering: the origin check applies to API routes too, which the
 * locale middleware deliberately never sees.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Whether an unsafe request came from this site.
 *
 * Two independent signals, either of which refuses. `Sec-Fetch-Site` is the
 * browser's own verdict and cannot be forged by a page; `Origin` is the older
 * check and the one non-browser clients may omit. An `Origin` that does not
 * parse — `null` from a sandboxed frame or a redirect chain is the common
 * case — is treated as foreign rather than allowed to throw.
 */
function isSameSite(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/**
 * Headers every response carries.
 *
 * Small, uncontroversial, and the kind a reviewer looks for first: no MIME
 * sniffing, no framing by other sites, referrers trimmed to the origin when
 * leaving it, and the browser features this app never asks for declared off.
 * Geolocation and the camera stay on for this origin alone — the map centres on
 * the phone's fix and a place submission can take a photo.
 */
function withSecurityHeaders<T extends Response>(response: T): T {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "SAMEORIGIN");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "permissions-policy",
    "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()",
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

  // API routes carry no locale: their paths are part of a published contract.
  if (request.nextUrl.pathname.startsWith("/api")) {
    return withSecurityHeaders(NextResponse.next());
  }

  if (
    routeAccess(request.nextUrl.pathname) === "member" &&
    !getSessionCookie(request)
  ) {
    const url = request.nextUrl.clone();
    const locale = request.nextUrl.pathname.split("/").filter(Boolean)[0];
    const prefix = routing.locales.includes(locale as "es") ? `/${locale}` : "";
    url.pathname = `${prefix}/entrar`;
    url.search = "";
    url.searchParams.set(
      "callbackUrl",
      `${appPath(request.nextUrl.pathname)}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(url);
  }

  return withSecurityHeaders(intlMiddleware(request));
}

export const config = {
  // Everything except Next's own assets and files with an extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
