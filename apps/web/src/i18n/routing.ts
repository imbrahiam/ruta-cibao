import { defineRouting } from "next-intl/routing";

/**
 * Only Spanish is active. The `[locale]` segment and this config exist anyway
 * so adding English later means adding
 * `messages/<locale>.json` and a line here — not moving every route.
 *
 * `as-needed` keeps the default locale out of the URL, so today's paths are
 * `/mapa` rather than `/es/mapa`.
 */
export const routing = defineRouting({
  locales: ["es"],
  defaultLocale: "es",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
