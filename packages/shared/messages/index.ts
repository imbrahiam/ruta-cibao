import es from "./es.json";

/**
 * The one catalogue of things the platform says, for every surface: the native
 * app, the web, emails, SMS and PDFs. Adding a language means adding its JSON
 * file and a line here.
 */
export const catalogues = { es } as const;

export type Locale = keyof typeof catalogues;
export type Messages = typeof es;

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALES = Object.keys(catalogues) as Locale[];
