import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // The province runs on Santo Domingo time and Dominican pesos; formatting
    // must not follow whatever the reader's browser happens to be set to.
    timeZone: "America/Santo_Domingo",
    now: new Date(),
  };
});
