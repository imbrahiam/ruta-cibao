"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_MAP_STYLE, MAP_STYLE_IDS, type MapStyleId } from "./map-style";

export const BASE_MAPS = ["map", "satellite"] as const;
export type BaseMap = (typeof BASE_MAPS)[number];

/** What a reviewer picked: the kind of map and, for the road map, its style. */
export type MapChoice = { base: BaseMap; style: MapStyleId };

export const MAP_CHOICE_KEY = "ruta-admin-map-style";

const DEFAULT_CHOICE: MapChoice = { base: "map", style: DEFAULT_MAP_STYLE };

function parse(raw: string | null): MapChoice {
  if (!raw) return DEFAULT_CHOICE;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return DEFAULT_CHOICE;
    const { base, style } = value as Record<string, unknown>;
    return {
      base: BASE_MAPS.find((option) => option === base) ?? DEFAULT_CHOICE.base,
      style:
        MAP_STYLE_IDS.find((option) => option === style) ??
        DEFAULT_CHOICE.style,
    };
  } catch {
    return DEFAULT_CHOICE;
  }
}

// The store is the raw stored string: equal strings are equal snapshots, so
// `useSyncExternalStore` never loops, and every map on the page reads one
// value. Writes notify this tab's listeners; the `storage` event covers the
// others.
const listeners = new Set<() => void>();
let memory: string | null = null;
let memoryOnly = false;

function read(): string | null {
  if (memoryOnly) return memory;
  try {
    return window.localStorage.getItem(MAP_CHOICE_KEY);
  } catch {
    // expected: storage may be unavailable; the choice then lives in memory.
    return memory;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === MAP_CHOICE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function write(choice: MapChoice) {
  const raw = JSON.stringify(choice);
  memory = raw;
  try {
    window.localStorage.setItem(MAP_CHOICE_KEY, raw);
  } catch {
    memoryOnly = true;
    // expected: storage may be unavailable; the choice stays in memory.
  }
  for (const listener of listeners) listener();
}

/**
 * The map the desk draws, shared by every map on the page and kept across
 * visits. It is read from storage in the first client render, before any map
 * has loaded, so nothing is drawn in one style and then repainted in another;
 * the server (and the first hydration pass) see the default.
 */
export function useMapChoice(): [
  MapChoice,
  (patch: Partial<MapChoice>) => void,
] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const choice = useMemo(() => parse(raw), [raw]);
  const update = useCallback((patch: Partial<MapChoice>) => {
    write({ ...parse(read()), ...patch });
  }, []);
  return [choice, update];
}
