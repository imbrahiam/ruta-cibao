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

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    additionalPrecacheEntries: [{ url: "/offline", revision }],
    useNativeEsbuild: true,
  });
