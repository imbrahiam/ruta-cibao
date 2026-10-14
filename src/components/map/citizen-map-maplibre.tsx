"use client";

import type { Feature, LineString } from "geojson";
import {
  addProtocol,
  getVersion,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  type MapMouseEvent,
  NavigationControl,
  removeProtocol,
  setWorkerUrl,
} from "maplibre-gl";
import { useTranslations } from "next-intl";
import { Protocol } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import { useBoundaries } from "@/hooks/use-boundaries";
import { publicEnv } from "@/lib/env.public";
import {
  COUNTRY_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
  PLACE_LABEL_ZOOM,
  PLACES_SOURCE_ID,
  PLACES_TILE_URL,
  PROVINCE_BOUNDS,
} from "@/lib/map/config";
import {
  CLUSTERS_LAYER_ID,
  CLUSTERS_SINGLE_LAYER_ID,
  categoryFilter,
  clusterLayers,
  INTERACTIVE_LAYER_IDS,
  PLACES_LAYER_ID,
  pinImage,
  placesLayers,
  provinceLayers,
  provinceSources,
} from "@/lib/map/layers";
import { markerPin, markerSize } from "@/lib/map/marker-pin";
import { buildMapStyle } from "@/lib/map/style";
import { installPinResolver } from "./maplibre-pins";
import {
  mapOverlays,
  OVERLAY_COMPACT_CLASS,
  overlayChip,
} from "./overlay-features";
import type { CitizenMapProps } from "./types";
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
  communityFeatures,
  onSelectCommunity,
  trafficReports,
  onSelectTraffic,
  draftPath,
  hoverPath,
  onMapPoint,
  selectedId,
  categoryIds,
  flyTo,
  searchMarker,
  pickingLocation = false,
  onViewportChange,
  onMovingChange,
  onSelect,
}: CitizenMapProps) {
  const t = useTranslations("map.accessibility");
  const localeRef = useRef({
    "Map.Title": t("title"),
    "NavigationControl.ZoomIn": t("zoomIn"),
    "NavigationControl.ZoomOut": t("zoomOut"),
    "AttributionControl.ToggleAttribution": t("attribution"),
  });
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const { data: boundaries } = useBoundaries();
  const pointRef = useRef(onMapPoint);
  pointRef.current = onMapPoint;
  const map = useRef<MapLibreMap | null>(null);
  const searchLayer = useRef<MapLibreMarker | null>(null);
  // Held in a ref so changing the handler never tears the map down and
  // rebuilds it, which would lose the viewport the person had panned to.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const onMovingChangeRef = useRef(onMovingChange);
  onMovingChangeRef.current = onMovingChange;
  const pickingLocationRef = useRef(pickingLocation);
  pickingLocationRef.current = pickingLocation;

  useEffect(() => {
    if (!container.current || map.current) return;

    // The bundled worker URL does not survive Turbopack; this copy does.
    // See `scripts/vendor-maplibre.ts`.
    setWorkerUrl(`/vendor/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);

    const basemap = resolveBasemap();

    // A PMTiles archive is one file read by range request, which MapLibre only
    // understands once this protocol is registered — before the map is built,
    // because the style references it immediately.
    const protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);

    const instance = new MapLibreMap({
      container: container.current,
      locale: localeRef.current,
      // High-density phones otherwise shade nearly seven pixels per CSS pixel.
      // Two keeps labels crisp while reducing the GPU fill and buffer cost.
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      style: buildMapStyle(basemap, window.location.origin),
      // Opens on the province itself, framed clear of the search bar and
      // chips above and the tab bar below, whatever the screen's shape.
      bounds: PROVINCE_BOUNDS,
      fitBoundsOptions: {
        padding: { top: 132, bottom: 72, left: 24, right: 24 },
      },
      minZoom: MIN_ZOOM,
      maxBounds: COUNTRY_BOUNDS,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
      // The province is flat enough that tilting adds nothing and costs a
      // gesture people trigger by accident with two thumbs.
      pitchWithRotate: false,
      dragRotate: false,
    });

    // Zoom only. Location has one control — `MapActions` — shared by every
    // renderer, so a second geolocate button here would be two targets for
    // the same action in the same corner.
    // Only where there is a mouse: on a touchscreen a pinch is the zoom, and
    // a second pair of buttons beside `MapActions` is clutter.
    if (window.matchMedia("(pointer: fine)").matches) {
      instance.addControl(
        new NavigationControl({ showCompass: false }),
        "bottom-right",
      );
    }

    installPinResolver(instance);

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
      setReady(true);
    });

    instance.on("click", (event: MapMouseEvent) => {
      if (pickingLocationRef.current) {
        pointRef.current?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
        return;
      }

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

      const { id, slug, name, category } = feature.properties as {
        id?: string;
        slug?: string;
        name?: string;
        category?: string;
      };
      onSelectRef.current(
        id && slug ? { id, slug, name, categoryId: category } : null,
      );
    });

    // Traffic chips shrink to dots until street level — see `overlayChip`.
    const compactOverlays = () => {
      instance
        .getContainer()
        .classList.toggle(
          OVERLAY_COMPACT_CLASS,
          instance.getZoom() < PLACE_LABEL_ZOOM,
        );
    };
    compactOverlays();
    instance.on("zoomend", compactOverlays);

    instance.on("movestart", () => onMovingChangeRef.current?.(true));
    instance.on("moveend", () => {
      const center = instance.getCenter();
      onMovingChangeRef.current?.(false);
      onViewportChangeRef.current?.({
        lng: center.lng,
        lat: center.lat,
        zoom: instance.getZoom(),
        bounds: {
          west: instance.getBounds().getWest(),
          east: instance.getBounds().getEast(),
          south: instance.getBounds().getSouth(),
          north: instance.getBounds().getNorth(),
        },
      });
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
    const initialCenter = instance.getCenter();
    onViewportChangeRef.current?.({
      lng: initialCenter.lng,
      lat: initialCenter.lat,
      zoom: instance.getZoom(),
    });

    return () => {
      instance.remove();
      map.current = null;
      removeProtocol("pmtiles");
    };
  }, []);

  // Redraw the markers when the selection changes, rather than rebuilding the
  // map: only the selection-dependent properties change.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    for (const layer of placesLayers(selectedId)) {
      if (!instance.getLayer(layer.id)) continue;
      if (layer.type === "symbol" && layer.id === PLACES_LAYER_ID) {
        for (const [property, value] of Object.entries(layer.layout ?? {})) {
          instance.setLayoutProperty(
            layer.id,
            property as never,
            value as never,
          );
        }
      }
      if (layer.type === "circle") {
        for (const [property, value] of Object.entries(layer.paint ?? {})) {
          instance.setPaintProperty(
            layer.id,
            property as never,
            value as never,
          );
        }
      }
    }
    if (instance.getLayer(CLUSTERS_SINGLE_LAYER_ID)) {
      instance.setLayoutProperty(
        CLUSTERS_SINGLE_LAYER_ID,
        "icon-image",
        pinImage(selectedId),
      );
    }
  }, [selectedId, ready]);

  // The province outline arrives on its own request, after the map is up; it
  // goes in beneath the pins so it never covers a place.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !boundaries?.features.length) return;
    const sources = provinceSources(boundaries);
    for (const [id, source] of Object.entries(sources)) {
      if (!instance.getSource(id)) instance.addSource(id, source);
    }
    for (const layer of provinceLayers()) {
      if (!instance.getLayer(layer.id)) {
        instance.addLayer(layer, CLUSTERS_LAYER_ID);
      }
    }
  }, [boundaries, ready]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    for (const layer of clusterLayers(categoryIds)) {
      if (!instance.getLayer(layer.id)) continue;
      instance.setFilter(
        layer.id,
        "filter" in layer ? (layer.filter ?? null) : null,
      );
      if (layer.type === "symbol") {
        instance.setLayoutProperty(
          layer.id,
          "text-field",
          layer.layout?.["text-field"],
        );
      }
      if (layer.type === "circle") {
        instance.setPaintProperty(
          layer.id,
          "circle-radius",
          layer.paint?.["circle-radius"],
        );
        instance.setPaintProperty(
          layer.id,
          "circle-color",
          layer.paint?.["circle-color"],
        );
      }
    }
    const filter = categoryFilter(categoryIds);
    for (const layer of placesLayers(null)) {
      if (instance.getLayer(layer.id)) {
        instance.setFilter(layer.id, filter ?? null);
      }
    }
  }, [categoryIds, ready]);

  useEffect(() => {
    if (!flyTo || !ready) return;
    // `easeTo`, not `flyTo`: the zoom-out-and-back arc is disorienting on a
    // small screen and slower to read than a straight move. The offset lands
    // the point at viewport centre plus offset — centre plus nothing without
    // one, so every existing flight is unchanged.
    map.current?.easeTo({
      center: { lng: flyTo.lng, lat: flyTo.lat },
      zoom: flyTo.zoom ?? 16,
      offset: [flyTo.offset?.x ?? 0, flyTo.offset?.y ?? 0],
      duration: 700,
    });
  }, [flyTo, ready]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const overlays = mapOverlays({
      communityFeatures,
      onSelectCommunity,
      trafficReports,
      onSelectTraffic,
      draftPath,
      hoverPath,
    });
    const lines: Feature<LineString>[] = overlays
      .filter((item) => item.path && item.path.length > 1)
      .map((item) => ({
        type: "Feature",
        properties: { id: item.id, color: item.color },
        geometry: {
          type: "LineString",
          coordinates: (item.path ?? []).map(({ lng, lat }) => [lng, lat]),
        },
      }));
    instance.addSource("community-overlays", {
      type: "geojson",
      data: { type: "FeatureCollection", features: lines },
    });
    instance.addLayer({
      id: "community-halo",
      type: "line",
      source: "community-overlays",
      paint: { "line-color": "#ffffff", "line-width": 9 },
    });
    instance.addLayer({
      id: "community-lines",
      type: "line",
      source: "community-overlays",
      paint: { "line-color": ["get", "color"], "line-width": 5 },
    });
    const clickLine = (event: MapMouseEvent) => {
      if (pickingLocation) return;
      const feature = instance.queryRenderedFeatures(event.point, {
        layers: ["community-lines"],
      })[0];
      overlays.find((item) => item.id === feature?.properties?.id)?.select?.();
    };
    instance.on("click", "community-lines", clickLine);
    const markers: MapLibreMarker[] = [];
    for (const overlay of overlays) {
      if (!overlay.point || !overlay.label) continue;
      const button = overlayChip(overlay);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!pickingLocation) overlay.select?.();
      });
      markers.push(
        new MapLibreMarker({ element: button })
          .setLngLat([overlay.point.lng, overlay.point.lat])
          .addTo(instance),
      );
    }
    return () => {
      instance.off("click", "community-lines", clickLine);
      for (const marker of markers) marker.remove();
      if (instance.getLayer("community-lines"))
        instance.removeLayer("community-lines");
      if (instance.getLayer("community-halo"))
        instance.removeLayer("community-halo");
      if (instance.getSource("community-overlays"))
        instance.removeSource("community-overlays");
    };
  }, [
    ready,
    communityFeatures,
    onSelectCommunity,
    trafficReports,
    onSelectTraffic,
    draftPath,
    hoverPath,
    pickingLocation,
  ]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !searchMarker) return;

    const size = markerSize(true);
    const element = document.createElement("div");
    element.style.width = `${size.width}px`;
    element.style.height = `${size.height}px`;
    element.style.backgroundImage = `url("${markerPin("#2563eb", "map-pin", true)}")`;
    element.style.backgroundSize = "contain";
    element.title = searchMarker.label;

    const marker = new MapLibreMarker({ element, anchor: "bottom" })
      .setLngLat([searchMarker.lng, searchMarker.lat])
      .addTo(instance);
    searchLayer.current = marker;

    return () => {
      marker.remove();
      if (searchLayer.current === marker) searchLayer.current = null;
    };
  }, [searchMarker]);

  useEffect(() => {
    const canvas = map.current?.getCanvas();
    if (canvas) canvas.style.cursor = pickingLocation ? "grab" : "";
  }, [pickingLocation]);

  // `h-full w-full`, not `absolute inset-0`: MapLibre's stylesheet sets
  // `.maplibregl-map { position: relative }` outside any cascade layer, which
  // beats Tailwind's layered utilities and left the map zero pixels tall.
  return <div ref={container} className="h-full w-full" />;
}
