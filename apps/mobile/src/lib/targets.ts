import { parseAppTarget } from "@ruta/shared/app-target";
import { type Href, router } from "expo-router";
import { focusOnMap } from "@/features/map/focus";

/** Whether the app has a screen for a canonical link (`/s/place/…`). */
export function canOpenTarget(href: string | null | undefined): boolean {
  if (!href) return false;
  const target = parseAppTarget(href);
  return target !== null && target.kind !== "report";
}

/**
 * Opens a canonical link (`/s/place/presa-de-moncion`) where it lives in the
 * app. A traffic report has no screen of its own: it is a stretch on the map,
 * so the map tab is brought forward with the report selected. Returns false
 * when the app has nowhere to show it.
 */
export function openTarget(
  href: string | null | undefined,
  { replace = false }: { replace?: boolean } = {},
): boolean {
  if (!href) return false;
  const target = parseAppTarget(href);
  if (!target) return false;

  let route: Href;
  switch (target.kind) {
    case "traffic":
      focusOnMap("traffic", target.ref);
      // From a link screen on the root stack: drop it and reveal the tabs
      // underneath (or the tabs alone, if the link opened the app cold and
      // nothing is beneath). From inside the tabs: switch to the map tab.
      if (!replace) router.navigate("/");
      else if (router.canDismiss()) router.dismissTo("/");
      else router.replace("/");
      return true;
    case "report":
      return false;
    case "place":
      route = `/place/${target.ref}`;
      break;
    case "route":
      route = `/route/${target.ref}`;
      break;
    case "consultation":
      route = `/consultation/${target.ref}`;
      break;
    case "contributions":
      route = "/contributions";
      break;
  }
  if (replace) router.replace(route);
  else router.push(route);
  return true;
}
