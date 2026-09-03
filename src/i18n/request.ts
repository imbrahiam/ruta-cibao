import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { formats, TIME_ZONE } from "./config";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // The province runs on Santo Domingo time; formatting must not follow
    // whatever the reader's browser happens to be set to.
    timeZone: TIME_ZONE,
    formats,
    // No `now` here on purpose: a fixed clock read at config time cannot be
    // prerendered, and it would pin relative dates for every reader. Components
    // that show relative time pass their own, inside a dynamic boundary.
  };
});
