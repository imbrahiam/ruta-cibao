"use client";

import type * as LeafletTypes from "leaflet";
import { useEffect, useRef, useState } from "react";
import { RASTER_BASEMAP } from "@/lib/map/basemap";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PROVINCE_BOUNDS,
  PROVINCE_CENTER,
} from "@/lib/map/config";
import { mapPalette } from "@/lib/map/palette";
import type { PlaceSelection } from "./types";

/** The properties every feature from `/api/places/geojson` carries. */
type PlaceProperties = {
  id: string;
  slug: string;
  name: string;
  category: string;
  color: string;
};

/** Leaflet types the properties as `any`; this names what is actually there. */
function propertiesOf(
  feature: { properties?: unknown } | undefined,
): PlaceProperties | null {
  const properties = feature?.properties as PlaceProperties | undefined;
  return properties?.id ? properties : null;
}

/**
 * The map.
 *
 * Leaflet, driven imperatively against a container ref. The library is loaded
 * with a dynamic `import()` inside the effect rather than through a lazily
 * mounted component: Leaflet touches `window` at module scope, so it cannot be
 * imported on the server, and wrapping the whole component in a lazy boundary
 * meant that when its chunk failed to arrive nothing rendered at all — not even
 * the container. This way the container is always in the DOM and only the
 * library arrives late.
 *
 * Everything the map decides — the basemap URL, the bounds, the palette —
 * comes from `@/lib/map`, which is plain data with no React and no DOM in it.
 * That is the seam a React Native build comes in at.
 */
export function CitizenMap({
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
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletTypes.Map | null>(null);
  const layer = useRef<LeafletTypes.GeoJSON | null>(null);
  const leaflet = useRef<typeof LeafletTypes | null>(null);

  const [failed, setFailed] = useState<string | null>(null);

  // Held in refs so a new handler never tears the map down and rebuilds it,
  // which would lose the viewport someone had panned to.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    if (!container.current || map.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !container.current) return;

      leaflet.current = L;

      const instance = L.map(container.current, {
        center: [PROVINCE_CENTER.latitude, PROVINCE_CENTER.longitude],
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // This is a provincial platform: panning to Santo Domingo to find an
        // empty map is worse than gently declining to go there.
        maxBounds: L.latLngBounds(
          [PROVINCE_BOUNDS[1], PROVINCE_BOUNDS[0]],
          [PROVINCE_BOUNDS[3], PROVINCE_BOUNDS[2]],
        ),
        maxBoundsViscosity: 0.8,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer(RASTER_BASEMAP.url, {
        attribution: RASTER_BASEMAP.attribution,
        subdomains: RASTER_BASEMAP.subdomains,
        maxZoom: RASTER_BASEMAP.maxZoom,
      }).addTo(instance);

      L.control.zoom({ position: "bottomright" }).addTo(instance);

      // A tap on empty ground closes whatever was open, which is what people
      // expect from a map and saves them hunting for a close button.
      instance.on("click", () => onSelectRef.current(null));

      map.current = instance;

      try {
        const response = await fetch("/api/places/geojson");
        if (!response.ok)
          throw new Error(`places responded ${response.status}`);
        const collection = await response.json();
        if (cancelled) return;

        layer.current = L.geoJSON(collection, {
          pointToLayer: (feature, latlng) => {
            const properties = propertiesOf(feature);
            const isSelected = properties?.id === selectedRef.current;

            // A white ring is what separates a marker from the ground beneath
            // it on a map this pale, and it thickens on the selected one
            // instead of recolouring it — colour already means category.
            return L.circleMarker(latlng, {
              radius: isSelected ? 11 : 8,
              fillColor: properties?.color || mapPalette.ink,
              fillOpacity: 1,
              color: mapPalette.road,
              weight: isSelected ? 4 : 2,
            });
          },
          onEachFeature: (feature, marker) => {
            const properties = propertiesOf(feature);
            if (!properties) return;

            marker.on("click", (event) => {
              // Otherwise the map's own click handler closes it again.
              L.DomEvent.stopPropagation(event);
              onSelectRef.current({ id: properties.id, slug: properties.slug });
            });
            marker.bindTooltip(properties.name, {
              direction: "top",
              offset: [0, -10],
              opacity: 1,
            });
          },
        }).addTo(instance);
      } catch (error) {
        console.error("could not load places", error);
        if (!cancelled)
          setFailed(error instanceof Error ? error.message : "unknown error");
      }
    })().catch((error) => {
      console.error("could not start the map", error);
      if (!cancelled)
        setFailed(error instanceof Error ? error.message : "unknown error");
    });

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  /** Redraws the markers, rather than rebuilding the layer. */
  useEffect(() => {
    const L = leaflet.current;
    if (!L || !layer.current) return;

    layer.current.eachLayer((marker) => {
      const properties = propertiesOf(
        (marker as LeafletTypes.Layer & { feature?: { properties?: unknown } })
          .feature,
      );
      if (!properties || !(marker instanceof L.CircleMarker)) return;

      const isSelected = properties.id === selectedId;
      marker.setStyle({ weight: isSelected ? 4 : 2 });
      marker.setRadius(isSelected ? 11 : 8);
    });
  }, [selectedId]);

  /**
   * Shows only the chosen categories.
   *
   * An empty selection means everything, not nothing: a filter that hides the
   * whole map the moment you deselect the last chip is a trap.
   */
  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    if (!L || !instance || !layer.current) return;

    layer.current.eachLayer((marker) => {
      const properties = propertiesOf(
        (marker as LeafletTypes.Layer & { feature?: { properties?: unknown } })
          .feature,
      );
      if (!properties) return;

      const visible =
        categoryIds.length === 0 || categoryIds.includes(properties.category);
      const element = (marker as LeafletTypes.CircleMarker).getElement();
      if (element instanceof SVGElement) {
        element.style.display = visible ? "" : "none";
      }
    });
  }, [categoryIds]);

  useEffect(() => {
    if (!flyTo) return;
    // `setView`, not `flyTo`: the zoom-out-and-back arc is disorienting on a
    // small screen and slower to read than a straight move.
    map.current?.setView([flyTo.lat, flyTo.lng], 16, { animate: true });
  }, [flyTo]);

  return (
    <>
      <div ref={container} className="absolute inset-0" />
      {failed && (
        <p
          role="status"
          className="absolute inset-x-4 bottom-24 z-30 rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
        >
          {failed}
        </p>
      )}
    </>
  );
}
