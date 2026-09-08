"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { publicEnv } from "@/lib/env.public";

const GOOGLE_LIBRARIES = ["places"];

export const googlePlacesSearchEnabled = Boolean(
  publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const key = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
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
