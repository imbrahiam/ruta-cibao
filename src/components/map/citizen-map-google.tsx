"use client";

import { useQuery } from "@tanstack/react-query";
import {
  APIProvider,
  Map as GoogleMap,
  Marker,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { publicEnv } from "@/lib/env.public";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PROVINCE_CENTER,
} from "@/lib/map/config";
import { googleMapStyle, markerIcon } from "@/lib/map/google-style";
import type { PlaceSelection } from "./types";

const MAP_ID = "ruta-cibao";

type PlaceFeature = {
  properties: {
    id: string;
    slug: string;
    name: string;
    category: string;
    color: string;
  };
  geometry: { coordinates: [number, number] };
};

/** Moves the map when a search result asks it to, without remounting it. */
function MapController({
  flyTo,
}: {
  flyTo: { lng: number; lat: number } | null;
}) {
  const map = useMap(MAP_ID);

  useEffect(() => {
    if (!map || !flyTo) return;
    map.panTo({ lat: flyTo.lat, lng: flyTo.lng });
    map.setZoom(16);
  }, [map, flyTo]);

  return null;
}

/**
 * The map, on Google.
 *
 * One of three renderers kept side by side while the choice is open. This one
 * is familiar and reliable; what it costs is a bill per map load that the
 * municipality would inherit, and an offline map, since Google's terms forbid
 * caching tiles.
 *
 * The places come from the same GeoJSON endpoint every renderer reads, so
 * switching between them changes only what draws the points, never where they
 * come from.
 */
export function CitizenMapGoogle({
  selectedId,
  categoryIds,
  flyTo,
  onSelect,
}: {
  selectedId: string | null;
  categoryIds: string[];
  flyTo: { lng: number; lat: number } | null;
  onSelect: (place: PlaceSelection) => void;
}) {
  const { data } = useQuery({
    queryKey: ["places", "geojson"],
    queryFn: async (): Promise<{ features: PlaceFeature[] }> => {
      const response = await fetch("/api/places/geojson");
      if (!response.ok) throw new Error(`places responded ${response.status}`);
      return response.json();
    },
  });

  const key = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return (
      <div className="flex size-full items-center justify-center p-6 text-center text-muted-foreground text-sm">
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.
      </div>
    );
  }

  const visible = (data?.features ?? []).filter(
    // An empty selection means everything, not nothing.
    (feature) =>
      categoryIds.length === 0 ||
      categoryIds.includes(feature.properties.category),
  );

  return (
    <APIProvider apiKey={key}>
      <GoogleMap
        id={MAP_ID}
        className="size-full"
        defaultCenter={{
          lat: PROVINCE_CENTER.latitude,
          lng: PROVINCE_CENTER.longitude,
        }}
        defaultZoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        styles={googleMapStyle}
        disableDefaultUI
        zoomControl
        gestureHandling="greedy"
        clickableIcons={false}
        // A tap on empty ground closes whatever was open, which is what people
        // expect from a map and saves them hunting for a close button.
        onClick={() => onSelect(null)}
      >
        {visible.map((feature) => (
          <Marker
            key={feature.properties.id}
            position={{
              lat: feature.geometry.coordinates[1],
              lng: feature.geometry.coordinates[0],
            }}
            title={feature.properties.name}
            icon={{
              url: markerIcon(
                feature.properties.color,
                feature.properties.id === selectedId,
              ),
            }}
            onClick={() =>
              onSelect({
                id: feature.properties.id,
                slug: feature.properties.slug,
              })
            }
          />
        ))}

        <MapController flyTo={flyTo} />
      </GoogleMap>
    </APIProvider>
  );
}
