import {
  catalogues,
  DEFAULT_LOCALE,
  type Messages,
} from "@ruta/shared/messages";
import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";

export const TIME_ZONE = "America/Santo_Domingo";

declare module "use-intl" {
  interface AppConfig {
    Locale: "es";
    Messages: Messages;
  }
}

const formats = {
  dateTime: {
    short: { day: "numeric", month: "short" },
    long: { day: "numeric", month: "long", year: "numeric" },
    time: { hour: "numeric", minute: "2-digit" },
  },
  number: {
    distance: { style: "unit", unit: "kilometer", maximumFractionDigits: 1 },
  },
} as const;

/**
 * Spanish (Dominican Republic) throughout. Every string the app says comes from
 * the shared catalogue, so a missing key is a type error, not a blank label.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  return (
    <IntlProvider
      locale={DEFAULT_LOCALE}
      messages={catalogues[DEFAULT_LOCALE]}
      timeZone={TIME_ZONE}
      formats={formats}
    >
      {children}
    </IntlProvider>
  );
}
