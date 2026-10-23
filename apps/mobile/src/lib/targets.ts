import { parseAppTarget } from "@ruta/shared/app-target";
import type { Href } from "expo-router";

/**
 * Where a canonical link (`/s/place/presa-de-moncion`) opens in the app, or
 * null when the app has no screen for it.
 */
export function targetRoute(href: string | null | undefined): Href | null {
  if (!href) return null;
  const target = parseAppTarget(href);
  if (!target) return null;
  switch (target.kind) {
    case "place":
      return `/place/${target.ref}`;
    case "route":
      return `/route/${target.ref}`;
    case "consultation":
      return `/consultation/${target.ref}`;
    case "traffic":
      return { pathname: "/", params: { traffic: target.ref } };
    case "contributions":
      return "/contributions";
    case "report":
      return null;
  }
}
