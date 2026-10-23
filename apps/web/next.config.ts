import path from "node:path";
import type { NextConfig } from "next";

/**
 * Hosts allowed to request the dev server's own assets.
 *
 * `next dev` blocks cross-origin requests to `/_next/*`, so a phone on the
 * same Wi-Fi gets the HTML and then fails on every script. These are the
 * ranges a home or office router hands out, the mDNS name macOS publishes for
 * the machine, and the tunnels worth reaching for on mobile data. Ignored by
 * `next build`.
 */
const devOrigins = [
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, index) => `172.${16 + index}.*.*`),
  "*.local",
  "*.ngrok-free.app",
  "*.ngrok.io",
  "*.trycloudflare.com",
  ...(process.env.DEV_ORIGINS?.split(",").map((origin) => origin.trim()) ?? []),
].filter(Boolean);

/** The repository root: workspace packages live above this app. */
const workspaceRoot = path.join(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  /** Self-contained server bundle, so the runtime image needs no node_modules. */
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  transpilePackages: ["@ruta/shared", "@ruta/contracts"],
  allowedDevOrigins: devOrigins,
  devIndicators: false,
  /** `"use cache"` gives cached route handlers (tiles, boundaries) a lifetime. */
  cacheComponents: true,
};

export default nextConfig;
