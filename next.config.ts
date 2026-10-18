import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Hosts allowed to request the dev server's own assets.
 *
 * `next dev` blocks cross-origin requests to `/_next/*`, so opening
 * `http://192.168.1.20:3000` from a phone on the same Wi-Fi serves the HTML and
 * then fails on every script and on the HMR socket. These are the ranges a home
 * or office router hands out, the mDNS name macOS publishes for the machine,
 * and the two tunnels worth reaching for when the phone is on mobile data.
 *
 * Matching is per dot-separated segment, so `192.168.*.*` covers the subnet
 * without naming today's DHCP lease. Ignored by `next build`.
 */
const devOrigins = [
  "192.168.*.*",
  "10.*.*.*",
  // 172.16.0.0/12 — the sixteen blocks Docker and corporate routers use.
  ...Array.from({ length: 16 }, (_, index) => `172.${16 + index}.*.*`),
  "*.local",
  "*.ngrok-free.app",
  "*.ngrok.io",
  "*.trycloudflare.com",
  "fsociety",
  // Anything else this machine needs, without editing the file.
  ...(process.env.DEV_ORIGINS?.split(",").map((origin) => origin.trim()) ?? []),
].filter(Boolean);

const nextConfig: NextConfig = {
  /** Self-contained server bundle, so the runtime image needs no node_modules. */
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg"],

  allowedDevOrigins: devOrigins,
  // The floating dev badge sits where the map's credits button does.
  devIndicators: false,

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
  experimental: {
    globalNotFound: true,
  },
};

export default withSerwist(
  createNextIntlPlugin("./src/i18n/request.ts")(nextConfig),
);
