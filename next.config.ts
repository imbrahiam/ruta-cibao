import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /** Self-contained server bundle, so the runtime image needs no node_modules. */
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg"],

  /**
   * Instant navigation.
   *
   * `cacheComponents` lets `"use cache"` assign a lifetime to a function's
   * result so it can be part of the static shell; `partialPrefetching` makes
   * that shell what a <Link> prefetches. Together they are why this app needs
   * no skeleton screens: the shell is real content, already there when you
   * click, and only the genuinely per-user parts stream into a Suspense
   * boundary.
   *
   * Adopted now, with almost no UI written, because retrofitting it later
   * means auditing every route that reads cookies or headers.
   */
  cacheComponents: true,
  partialPrefetching: true,
};

export default withSerwist(
  createNextIntlPlugin("./src/i18n/request.ts")(nextConfig),
);
