"use client";

import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import {
  DEFAULT_VIEW_MODE,
  VIEW_MODES,
  type ViewMode,
} from "@/lib/map/view-mode";

const STORAGE_KEYS = {
  viewMode: "ruta-cibao:vista",
  traffic: "ruta-cibao:transito",
  alerts: "ruta-cibao:alertas",
  googlePlaces: "ruta-cibao:negocios",
} as const;

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private mode, full storage, disabled cookies: the URL still holds it.
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Same as above — losing the memory, not the setting.
  }
}

/**
 * How the map is drawn, and what is drawn on it.
 *
 * nuqs (the URL) is the primary store: a view survives refreshes, stays
 * shareable by pasting the address, and the back button still works. This
 * hook adds a localStorage fallback underneath it, so arriving with a clean
 * link — the rail, the bottom bar, a bookmark — reopens the last used
 * rendering instead of resetting to the defaults every time.
 *
 * The URL always wins when it says something: a shared `?vista=satelite`
 * opens as satellite even if this device remembers `mapa`, and is then
 * remembered in turn.
 */
export function useViewPreferences() {
  // Read once per mount: these are the defaults the URL states fall back to
  // when their parameter is absent.
  const [storedMode] = useState<ViewMode>(() => {
    const raw = readStored(STORAGE_KEYS.viewMode);
    return VIEW_MODES.includes(raw as ViewMode)
      ? (raw as ViewMode)
      : DEFAULT_VIEW_MODE;
  });
  const [storedTraffic] = useState(
    () => readStored(STORAGE_KEYS.traffic) === "1",
  );
  /**
   * On unless this device has turned it off — the opposite default from every
   * other layer here.
   *
   * What citizens report about the roads is the thing this platform knows that
   * no other map does, and a layer nobody switches on is a layer that does not
   * exist. The others are additions to the map; this one is the map.
   */
  const [storedAlerts] = useState(
    () => readStored(STORAGE_KEYS.alerts) !== "0",
  );
  const [storedPlaces] = useState(
    () => readStored(STORAGE_KEYS.googlePlaces) === "1",
  );

  const [viewMode, setViewMode] = useQueryState(
    "vista",
    parseAsString.withDefault(storedMode).withOptions({ shallow: true }),
  );
  const [traffic, setTraffic] = useQueryState(
    "transito",
    parseAsBoolean.withDefault(storedTraffic).withOptions({ shallow: true }),
  );
  const [alerts, setAlerts] = useQueryState(
    "alertas",
    parseAsBoolean.withDefault(storedAlerts).withOptions({ shallow: true }),
  );
  // Off by default: Google's restaurants and shops compete with the places the
  // province put there, which are the whole reason this map exists.
  const [googlePlaces, setGooglePlaces] = useQueryState(
    "negocios",
    parseAsBoolean.withDefault(storedPlaces).withOptions({ shallow: true }),
  );

  useEffect(() => {
    writeStored(STORAGE_KEYS.viewMode, viewMode);
  }, [viewMode]);
  useEffect(() => {
    writeStored(STORAGE_KEYS.traffic, traffic ? "1" : "0");
  }, [traffic]);
  useEffect(() => {
    writeStored(STORAGE_KEYS.alerts, alerts ? "1" : "0");
  }, [alerts]);
  useEffect(() => {
    writeStored(STORAGE_KEYS.googlePlaces, googlePlaces ? "1" : "0");
  }, [googlePlaces]);

  return {
    viewMode,
    setViewMode,
    traffic,
    setTraffic,
    alerts,
    setAlerts,
    googlePlaces,
    setGooglePlaces,
  };
}
