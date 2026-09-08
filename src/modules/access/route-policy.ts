import { routing } from "@/i18n/routing";

export type RouteAccess = "public" | "member";

const AUTH_CALLBACK_PATHS = new Set([
  "/",
  "/mapa",
  "/bienvenida",
  "/verificar",
  "/moderacion",
  "/explorar",
  "/aportes",
  "/cuenta",
  "/instalar",
  "/pendientes",
  "/consultas",
  "/informes",
  "/rutas",
  "/moderacion/temas",
]);

export function appPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && routing.locales.includes(segments[0] as "es")) {
    segments.shift();
  }
  return `/${segments.join("/")}`;
}

/** Paths that need a session before the page is even rendered. */
const MEMBER_PATHS = new Set(["/verificar", "/moderacion", "/informes"]);

export function routeAccess(pathname: string): RouteAccess {
  return MEMBER_PATHS.has(appPath(pathname)) ? "member" : "public";
}

/**
 * Accepts only a same-origin path before handing it to an auth callback.
 *
 * Also used for the `next` the welcome fork carries, which is why the fallback
 * is a parameter: sign-in falls back to the fork, and the fork falls back to
 * the map.
 */
export function safeCallbackPath(
  value: string | string[] | undefined,
  fallback = "/bienvenida",
): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;

  const base = new URL("https://ruta-cibao.local");
  const resolved = new URL(value, base);
  if (resolved.origin !== base.origin) return fallback;
  if (!AUTH_CALLBACK_PATHS.has(appPath(resolved.pathname))) return fallback;

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
