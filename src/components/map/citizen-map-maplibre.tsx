"use client";

import {
  addProtocol,
  GeolocateControl,
  Map as MapLibreMap,
  type MapMouseEvent,
  NavigationControl,
  removeProtocol,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";
import { publicEnv } from "@/lib/env.public";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PLACES_SOURCE_ID,
  PLACES_TILE_URL,
  PROVINCE_CENTER,
} from "@/lib/map/config";
import {
  CLUSTERS_LAYER_ID,
  categoryFilter,
  clusterLayers,
  INTERACTIVE_LAYER_IDS,
  placesLayers,
} from "@/lib/map/layers";
import { buildMapStyle } from "@/lib/map/style";
import type { PlaceSelection } from "./types";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The map.
 *
 * Driven imperatively against a container ref rather than through a React
 * wrapper. MapLibre owns a canvas and a WebGL context and wants to be told what
 * changed; wrapping that in a component tree adds a mount dance that has to
 * survive server rendering, streaming and StrictMode's double effects, and
 * gains nothing here because every update below is a one-line imperative call
 * anyway.
 *
 * Everything the map decides — the style, the layers, the bounds — comes from
 * `@/lib/map`, which is plain data with no React and no DOM in it. That is the
 * seam a React Native build comes in at: MapLibre Native reads the same style
 * JSON and the same tile URLs, and only this file is replaced.
 */
function resolveBasemap() {
  if (publicEnv.NEXT_PUBLIC_BASEMAP_PMTILES_URL) {
    return {
      kind: "pmtiles",
      url: publicEnv.NEXT_PUBLIC_BASEMAP_PMTILES_URL,
    } as const;
  }
  if (publicEnv.NEXT_PUBLIC_MAPTILER_KEY) {
    return {
      kind: "maptiler",
      key: publicEnv.NEXT_PUBLIC_MAPTILER_KEY,
    } as const;
  }
  return { kind: "none" } as const;
}

export function CitizenMap({
  selectedId,
  categoryIds,
  flyTo,
  onSelect,
}: {
  selectedId: string | null;
  categoryIds: string[];
  /** Where a search result asked the map to go. */
  flyTo: { lng: number; lat: number } | null;
  onSelect: (place: PlaceSelection) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  // Held in a ref so changing the handler never tears the map down and
  // rebuilds it, which would lose the viewport the person had panned to.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current || map.current) return;

    const basemap = resolveBasemap();

    // A PMTiles archive is one file read by range request, which MapLibre only
    // understands once this protocol is registered — before the map is built,
    // because the style references it immediately.
    const protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);

    const instance = new MapLibreMap({
      container: container.current,
      style: buildMapStyle(basemap, window.location.origin),
      center: [PROVINCE_CENTER.longitude, PROVINCE_CENTER.latitude],
      zoom: DEFAULT_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
      // The province is flat enough that tilting adds nothing and costs a
      // gesture people trigger by accident with two thumbs.
      pitchWithRotate: false,
      dragRotate: false,
    });

    instance.addControl(
      new NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    instance.addControl(
      new GeolocateControl({
        trackUserLocation: true,
        positionOptions: { enableHighAccuracy: true },
      }),
      "bottom-right",
    );

    instance.on("load", () => {
      instance.addSource(PLACES_SOURCE_ID, {
        type: "vector",
        // The braces must survive: MapLibre substitutes them textually, and a
        // percent-encoded template is requested literally and refused.
        tiles: [
          new URL(PLACES_TILE_URL, window.location.origin).href
            .replace(/%7B/g, "{")
            .replace(/%7D/g, "}"),
        ],
        minzoom: 0,
        maxzoom: 14,
      });

      for (const layer of [...clusterLayers(), ...placesLayers(null)]) {
        instance.addLayer(layer);
      }
    });

    instance.on("click", (event: MapMouseEvent) => {
      const features = instance.queryRenderedFeatures(event.point, {
        layers: INTERACTIVE_LAYER_IDS.filter((id) => instance.getLayer(id)),
      });

      const feature = features[0];

      // A tap on empty ground closes whatever was open, which is what people
      // expect from a map and saves them hunting for a close button.
      if (!feature) {
        onSelectRef.current(null);
        return;
      }

      // A cluster is not a destination, it is a "there are more here". Tapping
      // one moves in rather than opening anything.
      if (feature.layer.id === CLUSTERS_LAYER_ID) {
        if (feature.geometry.type === "Point") {
          const [lng, lat] = feature.geometry.coordinates as [number, number];
          instance.easeTo({
            center: { lng, lat },
            zoom: Math.min(instance.getZoom() + 2.5, MAX_ZOOM),
            duration: 500,
          });
        }
        return;
      }

      const { id, slug } = feature.properties as { id?: string; slug?: string };
      onSelectRef.current(id && slug ? { id, slug } : null);
    });

    // A pointer over something tappable, so a desktop user knows it is one.
    for (const layerId of INTERACTIVE_LAYER_IDS) {
      instance.on("mouseenter", layerId, () => {
        instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", layerId, () => {
        instance.getCanvas().style.cursor = "";
      });
    }

    // MapLibre reports tile, source and style failures here and nowhere else,
    // which is how a map ends up blank with a clean console.
    instance.on("error", (event) => {
      console.error("maplibre:", event.error?.message ?? event);
    });

    map.current = instance;

    return () => {
      instance.remove();
      map.current = null;
      removeProtocol("pmtiles");
    };
  }, []);

  // Redraw the markers when the selection changes, rather than rebuilding the
  // map: only the paint properties depend on it.
  useEffect(() => {
    const instance = map.current;
    if (!instance?.isStyleLoaded()) return;

    for (const layer of placesLayers(selectedId)) {
      if (!instance.getLayer(layer.id) || layer.type !== "circle") continue;
      const paint = layer.paint ?? {};
      for (const [property, value] of Object.entries(paint)) {
        instance.setPaintProperty(layer.id, property as never, value as never);
      }
    }
  }, [selectedId]);

  useEffect(() => {
    const instance = map.current;
    if (!instance?.isStyleLoaded()) return;

    const filter = categoryFilter(categoryIds);
    for (const layer of placesLayers(null)) {
      if (instance.getLayer(layer.id)) {
        instance.setFilter(layer.id, filter ?? null);
      }
    }
  }, [categoryIds]);

  useEffect(() => {
    if (!flyTo) return;
    // `easeTo`, not `flyTo`: the zoom-out-and-back arc is disorienting on a
    // small screen and slower to read than a straight move.
    map.current?.easeTo({ center: flyTo, zoom: 16, duration: 700 });
  }, [flyTo]);

  return <div ref={container} className="absolute inset-0" />;
}
