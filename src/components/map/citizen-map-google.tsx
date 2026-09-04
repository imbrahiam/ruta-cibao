"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { publicEnv } from "@/lib/env.public";
import { categoryIcon } from "@/lib/map/category-icons";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PROVINCE_CENTER,
} from "@/lib/map/config";
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
  onSelect,
}: {
  selectedId: string | null;
  categoryIds: string[];
  flyTo: { lng: number; lat: number } | null;
  traffic?: boolean;
  viewMode?: ViewMode;
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
  /**
   * Advanced markers need a Map ID. Google's documented development id works
   * without a console setup; a deployment sets its own so the styling and the
   * quota are its own.
   */
  const mapId = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

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
        mapTypeId={googleMapTypeFor(viewMode)}
        // A Map ID, which is what enables the pin-shaped markers below. It also
        // means Google renders its own cartography: the greens and tans of the
        // default map rather than a desaturated wash, which reads better here
        // — this is farmland and hills, and a map that shows that is telling
        // someone something true about where they are.
        mapId={mapId}
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
          const Icon = categoryIcon(icon);
          const isSelected = id === selectedId;

          return (
            <AdvancedMarker
              key={id}
              position={{
                lat: feature.geometry.coordinates[1],
                lng: feature.geometry.coordinates[0],
              }}
              title={name}
              zIndex={isSelected ? 2 : 1}
              onClick={() => onSelect({ id, slug })}
            >
              {/* Google's own pin shape, in the category's colour with its icon
                  inside. The shape is what makes a marker read as a place at a
                  glance; the icon is what says which kind without a legend. */}
              <Pin
                background={color}
                borderColor="#ffffff"
                glyphColor="#ffffff"
                scale={isSelected ? 1.4 : 1.1}
              >
                {/* The glyph goes in as children rather than through the
                    `glyph` prop, which takes a DOM element and not a React
                    one. */}
                <Icon className="size-4 text-white" />
              </Pin>
            </AdvancedMarker>
          );
        })}

        <TrafficLayer enabled={traffic} />
        <MapController flyTo={flyTo} />
      </GoogleMap>
    </APIProvider>
  );
}
