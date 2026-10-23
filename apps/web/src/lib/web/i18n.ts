import { catalogues } from "@ruta/shared/messages";
import { createFormatter, createTranslator } from "use-intl/core";
import { formats, TIME_ZONE } from "@/i18n/config";

/**
 * Spanish for the Dominican Republic, the only locale in the catalogue.
 *
 * The web reads the shared catalogue directly through `use-intl` rather than
 * through next-intl's request config: there is no locale segment in the URL
 * and nothing to negotiate, so the plugin would add a runtime read of the
 * request to every page for no gain.
 */
export const LOCALE = "es-DO";

type Namespace = keyof typeof catalogues.es;

/** A translator bound to one namespace, for server components and metadata. */
export function getT(namespace: Namespace) {
  return createTranslator({
    locale: LOCALE,
    messages: catalogues.es,
    namespace,
    timeZone: TIME_ZONE,
    formats,
  });
}

/** Dates and numbers in Santo Domingo time, for server components. */
export function getFormatter() {
  return createFormatter({ locale: LOCALE, timeZone: TIME_ZONE, formats });
}

/** The slice of the catalogue a client subtree needs, so the page ships no more. */
export function pickMessages(namespaces: Namespace[]) {
  return Object.fromEntries(namespaces.map((key) => [key, catalogues.es[key]]));
}
