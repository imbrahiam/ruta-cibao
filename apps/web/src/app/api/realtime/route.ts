import type { RealtimeEvent } from "@/db/schema";
import { createConnectionLimiter } from "@/lib/connection-limit";
import { errorDetails, logError } from "@/lib/log";
import { getRequestClientKey } from "@/lib/rate-limit";
import { drainEvents, onRealtimeNudge, userChannel } from "@/lib/realtime";
import { resolveSession } from "@/modules/access/session";

/**
 * The live stream.
 *
 * Server-Sent Events rather than WebSockets: the traffic here only ever flows
 * server to browser, EventSource reconnects on its own, and it passes through
 * Caddy with no upgrade handling to get wrong.
 *
 * Resumption is the whole point. Every message carries `id:`, so a browser that
 * loses signal sends `Last-Event-ID` when it comes back — the spec makes the
 * browser do this, there is no client code for it — and the gap is replayed
 * from the event log instead of vanishing.
 */

/** Public topics anyone may watch. `user:*` is granted per session, not asked for. */
const PUBLIC_CHANNELS = new Set([
  "traffic",
  "places",
  "routes",
  "consultations",
]);

const HEARTBEAT_MS = 25_000;
const MAX_SEEN = 500;

/**
 * Event streams live until the client leaves, so they cannot be governed by a
 * per-request rate limit. Four per client covers a phone, a laptop and a
 * reconnect overlap; the process ceiling stops a distributed client.
 */
const connections = createConnectionLimiter({ perClient: 4, total: 500 });

export async function GET(request: Request) {
  const url = new URL(request.url);

  // No default: subscribing someone to a topic they did not ask for would
  // spend their data on updates they never see.
  const requested = (url.searchParams.get("channels") ?? "")
    .split(",")
    .map((channel) => channel.trim())
    .filter((channel) => PUBLIC_CHANNELS.has(channel));

  // A viewer's own channel is derived from the session, never from the query
  // string — otherwise anyone could ask to read someone else's notifications.
  const { viewer } = await resolveSession(request.headers);
  const channels =
    viewer.kind === "anonymous"
      ? requested
      : [...requested, userChannel(viewer.userId)];

  if (channels.length === 0) {
    return new Response("no readable channels requested", { status: 400 });
  }

  const clientKey = getRequestClientKey(request.headers);
  if (!connections.acquire(clientKey)) {
    return new Response("too many open streams", {
      status: 429,
      headers: { "retry-after": "30" },
    });
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    connections.release(clientKey);
  };

  const lastEventId = Number.parseInt(
    request.headers.get("last-event-id") ??
      url.searchParams.get("lastEventId") ??
      "0",
    10,
  );

  let cursor =
    Number.isFinite(lastEventId) && lastEventId > 0 ? lastEventId : 0;
  const seen = new Set<number>();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (event: RealtimeEvent) => {
        if (seen.has(event.id)) return;
        seen.add(event.id);
        // Bounded: the sweep window is seconds wide, so old ids can be forgotten.
        if (seen.size > MAX_SEEN) {
          for (const id of seen) {
            seen.delete(id);
            if (seen.size <= MAX_SEEN / 2) break;
          }
        }
        if (event.id > cursor) cursor = event.id;

        write(
          `id: ${event.id}\nevent: ${event.action}\ndata: ${JSON.stringify(event)}\n\n`,
        );
      };

      let draining = false;
      const drain = async (includeSweep = false) => {
        // Serialised: a burst of notifications must not start overlapping
        // queries that then deliver the same rows out of order.
        if (draining || closed) return;
        draining = true;
        try {
          for (const event of await drainEvents({
            channels,
            afterId: cursor,
            includeSweep,
          }))
            send(event);
        } catch (error) {
          logError("realtime.drain_failed", errorDetails(error));
        } finally {
          draining = false;
        }
      };

      // Tells the browser how long to wait before reconnecting, then replays
      // whatever it missed while it was away.
      write("retry: 3000\n\n");
      await drain();

      const unsubscribe = await onRealtimeNudge(() => {
        void drain();
      });

      const heartbeat = setInterval(() => {
        // A comment keeps proxies from closing an idle connection, and the
        // sweep alongside it catches anything a dropped NOTIFY would have lost.
        write(": keep-alive\n\n");
        void drain(true);
      }, HEARTBEAT_MS);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        release();
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };

      request.signal.addEventListener("abort", close);
    },
    // The consumer went away without the request signal firing first.
    cancel() {
      release();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Caddy and nginx both buffer by default, which would hold messages back.
      "x-accel-buffering": "no",
    },
  });
}
