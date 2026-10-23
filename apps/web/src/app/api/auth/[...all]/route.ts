import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

/** Deferred to the first request; see the note in `@/lib/auth`. */
let handler: ReturnType<typeof toNextJsHandler> | undefined;

function route() {
  handler ??= toNextJsHandler(getAuth());
  return handler;
}

export const GET = (request: Request) => route().GET(request);
export const POST = (request: Request) => route().POST(request);
