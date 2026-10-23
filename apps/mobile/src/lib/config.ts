import Constants from "expo-constants";

/**
 * Build-time public configuration. Values are baked into the signed build of
 * each variant; none of them is a secret.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set for this build`);
  return value;
}

/** Origin of the Ruta Cibao API. The simulator reaches the host as localhost. */
export const API_ORIGIN = (
  process.env.EXPO_PUBLIC_API_ORIGIN ?? "http://localhost:3000"
).replace(/\/$/, "");

/** Mapbox public token: client-visible by design, scoped per variant. */
export const MAPBOX_ACCESS_TOKEN = required(
  "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN",
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
);

/** The URL scheme of the running variant (`rutacibao`, `rutacibao-dev`, …). */
export const APP_SCHEME = String(Constants.expoConfig?.scheme ?? "rutacibao");

export const APP_VARIANT = String(
  Constants.expoConfig?.extra?.variant ?? "development",
);
