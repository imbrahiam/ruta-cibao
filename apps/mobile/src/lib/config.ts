import Constants from "expo-constants";

/**
 * Build-time public configuration. Values are baked into the signed build of
 * each variant; none of them is a secret.
 */
/** Origin of the Ruta Cibao API. The simulator reaches the host as localhost. */
export const API_ORIGIN = (
  process.env.EXPO_PUBLIC_API_ORIGIN ?? "http://localhost:3000"
).replace(/\/$/, "");

/** The URL scheme of the running variant (`rutacibao`, `rutacibao-dev`, …). */
export const APP_SCHEME = String(Constants.expoConfig?.scheme ?? "rutacibao");

export const APP_VARIANT = String(
  Constants.expoConfig?.extra?.variant ?? "development",
);

/**
 * Basemap provider. Google unless the build opts into Apple Maps (iOS only),
 * which needs no key: see `features/map/basemap.ts`.
 */
export const MAP_PROVIDER: "google" | "apple" =
  process.env.EXPO_PUBLIC_MAP_PROVIDER === "apple" ? "apple" : "google";
