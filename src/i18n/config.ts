import type { Formats } from "next-intl";
import { CURRENCY } from "./currency";

/**
 * Formatting shared by the server config and the client provider.
 *
 * These are passed to `NextIntlClientProvider` explicitly rather than let it
 * read them from the request. The provider falls back to `getFormats()`,
 * `getTimeZone()` and friends for anything it is not given, and each of those
 * is a runtime read that pulls the whole page out of the static shell.
 */
export const TIME_ZONE = "America/Santo_Domingo";

export const formats = {
  dateTime: {
    short: { day: "numeric", month: "short", year: "numeric" },
    long: { day: "numeric", month: "long", year: "numeric" },
    time: { hour: "numeric", minute: "2-digit" },
  },
  number: {
    currency: {
      style: "currency",
      currency: CURRENCY,
      maximumFractionDigits: 0,
    },
    distance: { style: "unit", unit: "kilometer", maximumFractionDigits: 1 },
  },
} satisfies Formats;
