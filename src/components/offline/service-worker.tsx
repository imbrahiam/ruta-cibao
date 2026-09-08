import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";
import { ServiceWorkerCleanup } from "./service-worker-cleanup";
import { ServiceWorkerUpdate } from "./service-worker-update";

/**
 * Registers the service worker — in production only.
 *
 * In development it is actively harmful: it intercepts every request, and when
 * a module script comes back through the cache with the wrong content type the
 * browser refuses it outright ("non-JavaScript MIME type of text/html"). The
 * page then renders its shell with none of its JavaScript, which looks like a
 * broken feature rather than a broken cache.
 *
 * The `@serwist/next` plugin had a `disable` option that did this; the
 * Turbopack integration registers unconditionally, so the gate lives here.
 * Nothing is lost — there is nothing to cache for a server that rebuilds on
 * every keystroke.
 */
export function ServiceWorker({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "production") {
    return (
      <>
        <ServiceWorkerCleanup />
        {children}
      </>
    );
  }

  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      <ServiceWorkerUpdate />
      {children}
    </SerwistProvider>
  );
}
