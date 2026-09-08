/// <reference lib="webworker" />
import {
  type AnyNestedClient,
  createORPCClient,
  ORPCError,
} from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  RangeRequestsPlugin,
  Serwist,
} from "serwist";
import { OFFLINE_SYNC_TAG } from "@/lib/offline/background-sync";
import { BASEMAP_CACHE } from "@/lib/offline/basemap";
import { drainQueue } from "@/lib/offline/drain";
import { isQueueProcedure } from "@/lib/offline/procedures";
import type { QueuedMutation } from "@/lib/offline/queue";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }

  /** Background Sync, which TypeScript's worker lib does not describe. */
  interface SyncEvent extends ExtendableEvent {
    readonly tag: string;
    readonly lastChance: boolean;
  }

  interface ServiceWorkerGlobalScopeEventMap {
    sync: SyncEvent;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * The offline shell.
 *
 * The point is not to work fully offline — the map needs tiles and the reports
 * need a server. It is that opening the app in a dead zone shows the app rather
 * than the browser's dinosaur, so someone can still write down what they see
 * and let the queue send it later.
 *
 * API routes are deliberately not cached. A stale answer about who is signed in
 * or what the map currently shows is worse than an honest failure the queue and
 * the live stream already know how to recover from.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin &&
        (url.pathname.startsWith("/_next/static/") ||
          url.pathname.startsWith("/places/") ||
          /^\/(icon[^/]*|apple-touch-icon)\.png$/.test(url.pathname)),
      handler: new CacheFirst({
        cacheName: "ruta-cibao-public-assets-v1",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 150,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // The province basemap, once the person has chosen to save it. The
    // renderer reads the file by byte range; a saved copy is the whole file,
    // and the plugin cuts each range out of it. Until it is saved nothing is
    // stored here — a ranged 206 is never cacheable — so every request simply
    // goes to the network.
    {
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && url.pathname.endsWith(".pmtiles"),
      handler: new CacheFirst({
        cacheName: BASEMAP_CACHE,
        plugins: [new RangeRequestsPlugin()],
      }),
    },
    // Page HTML can contain an account menu; RSC and APIs can contain private
    // data. Only the neutral offline document is precached.
    {
      matcher: () => true,
      handler: new NetworkOnly({ networkTimeoutSeconds: 8 }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

/**
 * The queue, replayed without a page.
 *
 * Chrome fires `sync` when connectivity returns after `enqueue` registered the
 * tag — typically with the app closed, which is the case the page's own flush
 * cannot cover. The worker asks who is signed in, sends that account's drafts
 * with the same `expectedUserId` check the page uses, and leaves anyone else's
 * in place. A signed-out phone sends nothing.
 *
 * Untyped on purpose. The page validates a draft against its Zod contract
 * before sending; here the row goes as stored and the server's own validation
 * answers `BAD_REQUEST` for a bad one — the same outcome, marked in the queue
 * and shown under `/pendientes` on the next open, without half a megabyte of
 * schema in the worker. A connection failure is rethrown so the browser
 * retries the sync later.
 */
type QueueContext = { expectedUserId?: string };
type RawProcedure = (
  input: unknown,
  options: { context: QueueContext },
) => Promise<unknown>;

const queueClient = createORPCClient<AnyNestedClient>(
  new RPCLink<QueueContext>({
    url: "/api/rpc",
    headers: ({ context }) =>
      context.expectedUserId
        ? { "x-expected-user-id": context.expectedUserId }
        : {},
  }),
) as unknown as Record<string, Record<string, RawProcedure> | undefined>;

function procedure(path: string): RawProcedure {
  const [namespace = "", name = ""] = path.split(".");
  const found = queueClient[namespace]?.[name];
  if (!found) throw new Error(`Unknown procedure ${path}`);
  return found;
}

async function sendRaw(item: QueuedMutation, userId: string): Promise<void> {
  if (!isQueueProcedure(item.procedure)) {
    // Something no version of the app ever queued. Marked, never sent.
    throw new ORPCError("BAD_REQUEST");
  }
  await procedure(item.procedure)(item.input, {
    context: { expectedUserId: userId },
  });
}

async function replayQueue(): Promise<void> {
  const viewer = (await procedure("me.get")(undefined, { context: {} })) as {
    userId: string | null;
  };
  if (!viewer.userId) return;

  const result = await drainQueue(viewer.userId, sendRaw);
  if (result.failed > 0) throw new Error("The queue could not be sent yet.");
}

self.addEventListener("sync", (event) => {
  if (event.tag !== OFFLINE_SYNC_TAG) return;
  event.waitUntil(replayQueue());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json() as {
    title: string;
    body: string;
    href?: string;
    tag?: string;
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { href: payload.href },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedHref =
    (event.notification.data as { href?: string } | undefined)?.href ?? "/";
  const destination = new URL(requestedHref, self.location.origin);
  const href =
    destination.origin === self.location.origin
      ? destination.href
      : self.location.origin;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Reuse a tab that is already open rather than piling up new ones.
        const existing = clients.find((candidate) => "focus" in candidate);
        if (existing)
          return existing.focus().then(() => existing.navigate(href));
        return self.clients.openWindow(href);
      }),
  );
});

serwist.addEventListeners();
