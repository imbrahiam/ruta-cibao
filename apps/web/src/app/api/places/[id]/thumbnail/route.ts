import { z } from "zod";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { googlePlacePhoto } from "@/modules/places/google-photo";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404 });
  const limit = await consumeRateLimit(getRequestClientKey(request.headers), {
    scope: "places-google-thumbnail",
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return new Response(null, {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    });
  }
  try {
    const photo = await googlePlacePhoto({ id });
    if (!photo)
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    const headers = new Headers({
      Location: photo.uri,
      "Cache-Control": "public, max-age=86400",
    });
    if (photo.attribution) {
      // HTTP header values must be Latin-1; preserve other names via URI encoding.
      const attribution = Array.from(photo.attribution, (character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127 ? " " : character;
      }).join("");
      headers.set(
        "X-Photo-Attribution",
        /^[\x20-\xff]*$/.test(attribution)
          ? attribution
          : encodeURIComponent(attribution),
      );
    }
    return new Response(null, { status: 302, headers });
  } catch {
    // Provider bodies, URLs and credentials must never enter application logs.
    return new Response(null, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
