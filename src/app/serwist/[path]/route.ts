import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

/**
 * Builds and serves the service worker.
 *
 * Serwist's Next.js plugin does not support Turbopack, which Next 16 uses by
 * default, so the worker is built through this route instead of by a bundler
 * plugin. It is `force-static`, so the work happens once at build time and the
 * result is served like any other asset.
 *
 * The revision versions the precached shell: without it, a browser that cached
 * the offline page in September would keep serving it after a deploy. The
 * commit hash is the natural value, with a random fallback for builds from a
 * tarball where git is not available.
 */
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf-8",
  }).stdout?.trim() || crypto.randomUUID();

const route = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  useNativeEsbuild: true,
});

export const generateStaticParams = route.generateStaticParams;

/**
 * Bundling the worker means running esbuild, which takes about a second.
 *
 * Serwist's own example marks the route `force-static`, but Cache Components
 * rejects segment config outright — so that export was being ignored and the
 * bundle was being rebuilt on every single request. Caching the produced bytes
 * is the equivalent under this model: esbuild runs once per path, and what is
 * cached is a string rather than a Response, which is not serialisable.
 */
async function bundle(
  path: string,
): Promise<{ body: string; contentType: string }> {
  "use cache";

  const response = await route.GET(
    new Request(`http://serwist.local/serwist/${path}`),
    {
      params: Promise.resolve({ path }),
    },
  );

  return {
    body: await response.text(),
    contentType:
      response.headers.get("content-type") ?? "application/javascript",
  };
}

/**
 * A worker whose only job is to remove itself.
 *
 * Served in development instead of the real one. A service worker installed by
 * an earlier production build keeps controlling localhost afterwards, and no
 * amount of not-registering-a-new-one dislodges it — the page's own cleanup
 * code cannot help either, because the stale worker is what stops that code
 * loading in the first place.
 *
 * Browsers re-fetch the worker script on navigation and install what they get,
 * so serving this is the one lever that reliably works from the server side.
 */
const KILL_SWITCH = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
`;

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string }> },
) {
  const { path } = await context.params;

  if (process.env.NODE_ENV !== "production") {
    return new Response(KILL_SWITCH, {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const { body, contentType } = await bundle(path);

  return new Response(body, {
    headers: {
      "content-type": contentType,
      // The browser must notice a new worker on deploy, so it revalidates every
      // time rather than trusting a cached copy.
      "cache-control": "public, max-age=0, must-revalidate",
      "service-worker-allowed": "/",
    },
  });
}
