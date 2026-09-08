import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { formats, TIME_ZONE } from "./config";
import { routing } from "./routing";

/**
 * Resolves the locale from the `[locale]` route segment.
 *
 * `next/root-params` reads it directly rather than through the request, which
 * is what replaced `setRequestLocale`: the old call had to be repeated at the
 * top of every layout and page, and forgetting one silently produced the
 * default language.
 *
 * The locale arrives through next-intl's params: a caller that already knows
 * it — a Server Action, which has no route context — hands it over explicitly
 * via `getTranslations({ locale })`, and routes keep resolving it from the
 * segment exactly as before.
 */
export default getRequestConfig(async ({ locale }) => {
  // An override the client sent along (a Server Action posts one); anything
  // else falls back to the default rather than trusting the wire.
  const requested =
    locale && hasLocale(routing.locales, locale)
      ? locale
      : ((await rootParams.locale()) as string);

  if (!hasLocale(routing.locales, requested)) {
    notFound();
  }

  return {
    locale: requested,
    messages: (await import(`../../messages/${requested}.json`)).default,
    // The province runs on Santo Domingo time; formatting must not follow
    // whatever the reader's browser happens to be set to.
    timeZone: TIME_ZONE,
    formats,
    // No `now` here on purpose: a fixed clock read at config time cannot be
    // prerendered, and it would pin relative dates for every reader. Components
    // that show relative time pass their own, inside a dynamic boundary.
  };
});
