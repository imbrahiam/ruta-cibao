"use client";

import { useEffect } from "react";

/**
 * Removes a service worker left behind by a production build.
 *
 * Not registering one in development is not enough: a worker installed by an
 * earlier `bun run build` keeps controlling the origin afterwards, intercepting
 * every request on localhost. When a module script comes back through it with
 * the wrong content type the browser refuses it outright, and the page renders
 * its shell with none of its JavaScript — which looks like a broken feature
 * rather than a stale cache.
 *
 * Someone who hits that has no reason to suspect the service worker, so this
 * clears it rather than leaving a troubleshooting note nobody will find.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        if (registrations.length === 0) return;

        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );

        // The caches outlive the registration, so they go too.
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        console.info(
          "[dev] Removed a service worker left over from a production build, and its caches. Reloading.",
        );
        window.location.reload();
      });
  }, []);

  return null;
}
