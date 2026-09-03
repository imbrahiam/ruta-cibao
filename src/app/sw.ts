/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
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
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
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
  const href =
    (event.notification.data as { href?: string } | undefined)?.href ?? "/";

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
