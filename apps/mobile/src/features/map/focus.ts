import { useSyncExternalStore } from "react";

/**
 * A request, from anywhere in the app, for the map tab to show one place:
 * search results, a share link, a notification. The map consumes it once.
 */
type FocusRequest = { placeId: string; at: number } | null;

let current: FocusRequest = null;
const listeners = new Set<() => void>();

export function focusPlaceOnMap(placeId: string) {
  current = { placeId, at: Date.now() };
  for (const listener of listeners) listener();
}

export function consumeFocusRequest() {
  current = null;
}

export function useFocusRequest(): FocusRequest {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
