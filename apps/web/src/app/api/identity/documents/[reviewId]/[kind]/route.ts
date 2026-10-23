import { requireModerator } from "@/modules/access/permissions";
import { getServerViewer } from "@/modules/access/server";
import {
  IdentityError,
  identityDocumentKind,
} from "@/modules/identity/contracts";
import { contentTypeOf } from "@/modules/identity/documents";
import { reviewDocument } from "@/modules/identity/review";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One photo from a verification request, decrypted, for a reviewer.
 *
 * Never cached anywhere — not by the browser, not by a proxy, not by the
 * service worker (which passes `/api` straight to the network) — and every
 * request is written to the audit log by `reviewDocument`.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ reviewId: string; kind: string }> },
) {
  const { reviewId, kind } = await context.params;
  const parsedKind = identityDocumentKind.safeParse(kind);
  if (!UUID.test(reviewId) || !parsedKind.success) {
    return new Response(null, { status: 404 });
  }

  let moderator: ReturnType<typeof requireModerator>;
  try {
    moderator = requireModerator(await getServerViewer());
  } catch {
    return new Response(null, { status: 403 });
  }

  try {
    const bytes = await reviewDocument(moderator, reviewId, parsedKind.data);
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": contentTypeOf(bytes),
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (error) {
    if (error instanceof IdentityError) {
      return new Response(null, {
        status: error.reason === "own_request" ? 403 : 404,
      });
    }
    throw error;
  }
}
