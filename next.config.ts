import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /** Self-contained server bundle, so the runtime image needs no node_modules. */
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
