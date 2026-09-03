import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Runs before every page and API request.
 *
 * Two jobs:
 *
 *  1. **Reject cross-site mutations.** Sessions are cookie-based, so a form on
 *     someone else's site could POST here and the browser would attach the
 *     cookie. Requiring Origin to match the host on every unsafe method stops
 *     that at the door, before any handler runs. This is belt-and-braces with
 *     oRPC v2 refusing GET on the RPC handler — together they mean no mutation
 *     is reachable from a cross-site page.
 *
 *  2. **Locale routing** for pages, via next-intl.
 *
 * Note the ordering: the origin check applies to API routes too, which the
 * locale middleware deliberately never sees.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const intlMiddleware = createIntlMiddleware(routing);

export function proxy(request: NextRequest) {
  if (!SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");

    // A same-origin fetch from a browser always sends Origin on an unsafe
    // method. A missing one means a non-browser client, which is fine; a
    // present one that does not match is a cross-site attempt.
    if (origin && new URL(origin).host !== request.headers.get("host")) {
      return NextResponse.json(
        { error: "cross-origin request rejected" },
        { status: 403 },
      );
    }
  }

  // API routes carry no locale: their paths are part of a published contract.
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  // Everything except Next's own assets and files with an extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
