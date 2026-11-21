"use client";

import { useSyncExternalStore } from "react";

/** What the viewer picked; `system` follows the device. */
export type AdminThemePreference = "system" | "light" | "dark";
export type AdminTheme = "light" | "dark";

import {
  ADMIN_THEME_ATTRIBUTE,
  ADMIN_THEME_KEY as KEY,
  ADMIN_THEME_QUERY as QUERY,
} from "./admin-theme-script";

/** The choice made this visit, for when storage is blocked (private mode). */
let unsaved: AdminThemePreference = "system";

function read(): AdminThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return unsaved;
  }
}

function resolve(preference: AdminThemePreference): AdminTheme {
  if (preference !== "system") return preference;
  return window.matchMedia(QUERY).matches ? "dark" : "light";
}

const listeners = new Set<() => void>();

function apply() {
  document.documentElement.setAttribute(ADMIN_THEME_ATTRIBUTE, resolve(read()));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(QUERY);
  const storage = (event: StorageEvent) => {
    if (event.key === KEY) apply();
  };
  // The device switching scheme, or another tab choosing a theme.
  media.addEventListener("change", apply);
  window.addEventListener("storage", storage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", apply);
    window.removeEventListener("storage", storage);
  };
}

/** The viewer's choice, and the theme it comes to on this device. */
export function useAdminTheme() {
  const preference = useSyncExternalStore(subscribe, read, () => "system");
  const theme = useSyncExternalStore(
    subscribe,
    () => resolve(read()),
    () => "light" as AdminTheme,
  );
  const setPreference = (next: AdminThemePreference) => {
    unsaved = next;
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // expected: storage blocked (private mode); `unsaved` keeps the choice for this visit.
    }
    apply();
  };
  return { preference, theme, setPreference };
}
