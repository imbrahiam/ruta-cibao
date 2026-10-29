import { z } from "zod";
import { logError } from "@/lib/log";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { RequestBodyTooLarge, readBoundedBody } from "@/lib/request-body";

/**
 * Where the native app reports a crash it survived.
 *
 * A phone in the countryside has no console a developer can read. This is the
 * smallest sink that makes a field failure visible without adding a vendor:
 * one bounded JSON body, one log line, nothing stored. It carries no identity,
 * no coordinates and no screen content, so a report cannot become a second
 * copy of the data the app works to protect.
 */
const schema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(4_000).optional(),
  platform: z.enum(["ios", "android", "web"]).optional(),
  appVersion: z.string().max(40).optional(),
  route: z.string().max(200).optional(),
});

const MAX_BODY_BYTES = 8_192;

export async function POST(request: Request) {
  const limit = await consumeRateLimit(getRequestClientKey(request.headers), {
    limit: 30,
    scope: "client-error",
    windowMs: 60 * 60 * 1_000,
  });
  if (!limit.allowed) {
    return new Response(null, {
      status: 429,
      headers: { "retry-after": String(limit.retryAfterSeconds) },
    });
  }

  // The declared length can lie or be absent on a chunked body, so the limit
  // is enforced while reading, not trusted from the header.
  let body: unknown;
  try {
    body = JSON.parse(
      new TextDecoder().decode(await readBoundedBody(request, MAX_BODY_BYTES)),
    );
  } catch (error) {
    return new Response(null, {
      status: error instanceof RequestBodyTooLarge ? 413 : 400,
    });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  logError("client.error", {
    requestId: request.headers.get("x-request-id") ?? "unknown",
    ...parsed.data,
  });
  return new Response(null, { status: 204 });
}
