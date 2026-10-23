import { revalidateTag } from "next/cache";
import { isInternalToken, PUBLIC_CACHE_TAGS } from "@/lib/web-cache";

/**
 * Internal: lets the worker drop the public place caches after a removal.
 * Not part of the API surface; it answers only to the shared internal token.
 */
export async function POST(request: Request) {
  if (!isInternalToken(request.headers.get("x-internal-token"))) {
    return new Response("Not found", { status: 404 });
  }
  for (const tag of PUBLIC_CACHE_TAGS) revalidateTag(tag, { expire: 0 });
  return new Response(null, { status: 204 });
}
