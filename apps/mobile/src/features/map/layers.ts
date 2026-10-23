import Storage from "expo-sqlite/kv-store";
import { useSyncExternalStore } from "react";

export type MapLayers = {
  places: boolean;
  traffic: boolean;
  routes: boolean;
  consultations: boolean;
  basemap: "standard" | "satellite";
};

const KEY = "map.layers.v1";

const DEFAULTS: MapLayers = {
  places: true,
  traffic: true,
  routes: true,
  consultations: false,
  basemap: "standard",
};

function load(): MapLayers {
  try {
    const raw = Storage.getItemSync(KEY);
    return raw
      ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<MapLayers>) }
      : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

/** Which layers the map shows. Remembered across launches. */
export function setMapLayers(patch: Partial<MapLayers>) {
  current = { ...current, ...patch };
  Storage.setItemSync(KEY, JSON.stringify(current));
  for (const listener of listeners) listener();
}

export function useMapLayers(): MapLayers {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
