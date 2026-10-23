import { useSyncExternalStore } from "react";

/** The point the location picker returned, for the form that opened it. */
export type PickedLocation = {
  lng: number;
  lat: number;
  municipalityId: string | null;
  municipalityName: string | null;
};

let current: PickedLocation | null = null;
const listeners = new Set<() => void>();

export function setPickedLocation(value: PickedLocation | null) {
  current = value;
  for (const listener of listeners) listener();
}

export function usePickedLocation(): PickedLocation | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
