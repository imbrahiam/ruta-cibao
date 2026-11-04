import { useSyncExternalStore } from "react";

/** The `md` breakpoint in globals.css (50.625rem), so JS and `md:` agree. */
const MOBILE_QUERY = "(width < 50.625rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}
