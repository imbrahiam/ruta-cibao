import { RequestBodyTooLarge, readBoundedBody } from "@/lib/request-body";
import { getServerViewer } from "@/modules/access/server";
import {
  IdentityError,
  MAX_DOCUMENT_BYTES,
} from "@/modules/identity/contracts";
import { submitIdentityReview } from "@/modules/identity/submit";

/**
 * The photos for a verification request, as one multipart post.
 *
 * Through this server rather than straight to storage (the way a place photo
 * goes) because these get encrypted before storage ever sees them, and the
 * key for that never leaves here. One request for all of them, so there is no
 * half-submitted state: the request either exists with its photos or does not
 * exist.
 */

/** Three photos at the limit, plus the multipart envelope around them. */
const MAX_BODY_BYTES = MAX_DOCUMENT_BYTES * 3 + 64 * 1024;

const STATUS: Record<IdentityError["reason"], number> = {
  already_verified: 409,
  already_submitted: 409,
  cedula_required: 409,
  invalid_file: 422,
  missing_file: 422,
  too_many: 429,
  not_found: 404,
  not_pending: 409,
  own_request: 403,
  registry_pending: 409,
  out_of_scope: 403,
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function bytesOf(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string") return null;
  return new Uint8Array(await value.arrayBuffer());
}

export async function POST(request: Request) {
  // The session cookie rides along on a cross-site form post, so a page on
  // another origin could otherwise file a request in a visitor's name. The
  // browser says where the request came from; anything not this site is
  // turned away before the body is read.
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let sameOrigin = origin === null;
  try {
    if (origin !== null) sameOrigin = new URL(origin).host === host;
  } catch {
    sameOrigin = false;
  }
  if (site === "cross-site" || !sameOrigin) {
    return json({ reason: "forbidden" }, 403);
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return json({ reason: "invalid_file" }, 413);

  const viewer = await getServerViewer();
  if (viewer.kind === "anonymous") return json({ reason: "unauthorized" }, 401);

  let form: FormData;
  try {
    const body = await readBoundedBody(request, MAX_BODY_BYTES);
    form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      body: Buffer.from(body),
    }).formData();
  } catch (error) {
    if (error instanceof RequestBodyTooLarge)
      return json({ reason: "invalid_file" }, 413);
    return json({ reason: "missing_file" }, 400);
  }

  try {
    const result = await submitIdentityReview(viewer, {
      front: await bytesOf(form.get("front")),
      selfie: await bytesOf(form.get("selfie")),
      residence: await bytesOf(form.get("residence")),
    });
    return json(result, 201);
  } catch (error) {
    if (error instanceof IdentityError) {
      return json(
        { reason: error.reason, detail: error.detail ?? null },
        STATUS[error.reason],
      );
    }
    throw error;
  }
}
