import { z } from "zod";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { streamAnswer, type Turn } from "@/modules/assistant/answer";
import { retrievePlaces } from "@/modules/assistant/retrieve";
import { smallTalkReply } from "@/modules/assistant/smalltalk";

/**
 * The assistant, as a stream.
 *
 * A route handler rather than an oRPC procedure: the answer arrives a token at
 * a time, and the RPC client is built around one request producing one result.
 * The contract is small enough to validate here at the boundary and keep the
 * typed API surface for things that are actually typed calls.
 *
 * Two events, in order. `places` first, because the cards are what the person
 * actually needs and they are ready before the first token of prose; then
 * `text` deltas; then `done`. A reader on a rural connection sees the useful
 * half immediately even if the sentence never finishes arriving.
 */
const body = z.object({
  question: z.string().trim().min(2).max(400),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .max(10)
    .default([]),
});

function event(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }

  // Embedding a question costs real CPU on a small server, so this is metered
  // per client the same way the geocoder is.
  const limit = await consumeRateLimit(getRequestClientKey(request), {
    scope: "assistant",
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return Response.json(
      { error: "too many requests" },
      {
        status: 429,
        headers: { "retry-after": String(limit.retryAfterSeconds) },
      },
    );
  }

  const { question, history } = parsed.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (name: string, data: unknown) =>
        controller.enqueue(encoder.encode(event(name, data)));

      try {
        // Small talk never reaches retrieval: a greeting always resembles
        // *some* place closely enough to come back as a card, and narrating
        // that coincidence as an answer is the failure. Empty places means
        // the frontend renders prose and nothing else.
        const canned = smallTalkReply(question);
        const places = canned ? [] : await retrievePlaces(question);
        send("places", places);

        for await (const chunk of streamAnswer(
          question,
          places,
          history as Turn[],
          canned,
        )) {
          send("text", chunk.text);
        }

        send("done", {});
      } catch (error) {
        console.error("assistant stream failed:", error);
        send("error", {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
    },
  });
}
