import { useSyncExternalStore } from "react";

/**
 * A request, from anywhere in the app, for the map tab to show one thing: a
 * place from search results, a traffic report from a share link or a
 * notification. The map consumes it once, whenever it is mounted and has the
 * data to resolve it.
 */
export type FocusRequest = {
  kind: "place" | "traffic";
  id: string;
  at: number;
} | null;

let current: FocusRequest = null;
const listeners = new Set<() => void>();

export function focusOnMap(kind: "place" | "traffic", id: string) {
  current = { kind, id, at: Date.now() };
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
