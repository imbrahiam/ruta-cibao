"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { publicEnv } from "@/lib/env.public";

const GOOGLE_LIBRARIES = ["places"];

/**
 * Google is loaded only when Google draws the map.
 *
 * Google's Service Specific Terms forbid using Places content "in conjunction
 * with a non-Google map" (the waiver is for EEA billing accounts only). With
 * MapLibre or Leaflet drawing, a "Lugares de Google" result plotted on our map
 * was exactly that — and the script cost every visitor a download for it.
 */
const googleDrawsTheMap =
  publicEnv.NEXT_PUBLIC_MAP_RENDERER !== "maplibre" &&
  publicEnv.NEXT_PUBLIC_MAP_RENDERER !== "leaflet";

export const googlePlacesSearchEnabled =
  googleDrawsTheMap && Boolean(publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const key = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key || !googleDrawsTheMap) {
    return children;
  }

  return (
    <APIProvider
      apiKey={key}
      libraries={GOOGLE_LIBRARIES}
      language="es"
      region="DO"
    >
      {children}
    </APIProvider>
  );
}
