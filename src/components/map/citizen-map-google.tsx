"use client";

import { useQuery } from "@tanstack/react-query";
import {
  APIProvider,
  Map as GoogleMap,
  Marker,
  useMap,
} from "@vis.gl/react-google-maps";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { publicEnv } from "@/lib/env.public";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  REGION_CENTER,
} from "@/lib/map/config";
import { googleMapStyle } from "@/lib/map/google-style";
import { locationDot, markerPin, markerSize } from "@/lib/map/marker-pin";
import {
  DEFAULT_VIEW_MODE,
  googleMapTypeFor,
  type ViewMode,
} from "@/lib/map/view-mode";
import type { PlaceSelection } from "./types";

const MAP_ID = "ruta-cibao";

type PlaceFeature = {
  properties: {
    id: string;
    slug: string;
    name: string;
    category: string;
    color: string;
    icon: string;
  };
  geometry: { coordinates: [number, number] };
};

/**
 * Live traffic on the roads.
 *
 * Google renders it as green through red along each road, which is the fastest
 * way for someone to see whether a route is moving — and it sits directly
 * alongside the traffic citizens report themselves, which is what this platform
 * adds on top: an official layer says a road is slow, a citizen says why.
 *
 * The library exposes no component for it, so it is attached to the map
 * imperatively and detached on unmount, which is what stops a second layer
 * being added every time the toggle flips.
 */
function TrafficLayer({ enabled }: { enabled: boolean }) {
  const map = useMap(MAP_ID);

  useEffect(() => {
    if (!map || !enabled) return;

    const layer = new google.maps.TrafficLayer();
    layer.setMap(map);

    return () => layer.setMap(null);
  }, [map, enabled]);

  return null;
}

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
  traffic = true,
  viewMode = DEFAULT_VIEW_MODE,
  googlePlaces = false,
  myLocation = null,
  onSelect,
}: {
  selectedId: string | null;
  categoryIds: string[];
  flyTo: { lng: number; lat: number } | null;
  traffic?: boolean;
  viewMode?: ViewMode;
  /** Google's own restaurants, shops and offices. Off by default. */
  googlePlaces?: boolean;
  myLocation?: { lng: number; lat: number } | null;
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

  const locationLabel = useTranslations("map.actions")("here");
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
          lat: REGION_CENTER.latitude,
          lng: REGION_CENTER.longitude,
        }}
        defaultZoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        mapTypeId={googleMapTypeFor(viewMode)}
        // No Map ID on purpose: one would enable Advanced Markers but make
        // Google ignore this style, and the style is the only way to clear its
        // own listings off the map.
        styles={googleMapStyle(googlePlaces)}
        disableDefaultUI
        zoomControl
        gestureHandling="greedy"
        clickableIcons={false}
        // A tap on empty ground closes whatever was open, which is what people
        // expect from a map and saves them hunting for a close button.
        onClick={() => onSelect(null)}
      >
        {visible.map((feature) => {
          const { id, slug, name, color, icon } = feature.properties;
          const isSelected = id === selectedId;
          const size = markerSize(isSelected);

          return (
            <Marker
              key={id}
              position={{
                lat: feature.geometry.coordinates[1],
                lng: feature.geometry.coordinates[0],
              }}
              title={name}
              zIndex={isSelected ? 2 : 1}
              icon={{
                url: markerPin(color, icon, isSelected),
                scaledSize: new google.maps.Size(size.width, size.height),
                // The point of the pin sits on the coordinate, not its middle.
                anchor: new google.maps.Point(size.width / 2, size.height),
              }}
              onClick={() => onSelect({ id, slug })}
            />
          );
        })}

        {myLocation && (
          // Not shaped like a place pin: the person is not a place, and giving
          // them the same shape as a hospital would put them in its class.
          <Marker
            position={{ lat: myLocation.lat, lng: myLocation.lng }}
            title={locationLabel}
            zIndex={3}
            clickable={false}
            icon={{
              url: locationDot(),
              scaledSize: new google.maps.Size(28, 28),
              anchor: new google.maps.Point(14, 14),
            }}
          />
        )}

        <TrafficLayer enabled={traffic} />
        <MapController flyTo={flyTo} />
      </GoogleMap>
    </APIProvider>
  );
}
