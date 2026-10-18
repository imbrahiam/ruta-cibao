"use client";

import type { GeoJSON as GeoJSONValue } from "geojson";
import {
  addProtocol,
  getVersion,
  type LayerSpecification,
  type LngLatBoundsLike,
  type LngLatLike,
  Map as MapLibreMap,
  Marker,
  type PaddingOptions,
  type SourceSpecification,
  setWorkerUrl,
} from "maplibre-gl";
import { useTheme } from "next-themes";
import { Protocol } from "pmtiles";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { publicEnv } from "@/lib/env.public";
import { COUNTRY_BOUNDS, MAX_ZOOM, MIN_ZOOM } from "@/lib/map/config";
import type { MapTheme } from "@/lib/map/palette";
import { basemapStyle } from "@/lib/map/style";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The map, and the contract every overlay follows.
 *
 * MapLibre owns a canvas and wants to be told what changed, so the instance is
 * created once and driven imperatively. Switching between the light and dark
 * styles replaces every layer, which is why overlays never add themselves
 * once: they subscribe to `styleEpoch` and re-add their source and layers
 * each time a style finishes loading. That one rule is what lets the theme
 * change under a selected place, a drawn road and a located user without any
 * of them disappearing.
 */
type MapContextValue = {
  map: MapLibreMap | null;
  styleEpoch: number;
  theme: MapTheme;
};

const MapContext = createContext<MapContextValue>({
  map: null,
  styleEpoch: 0,
  theme: "light",
});

export function useMapContext() {
  return useContext(MapContext);
}

let protocolInstalled = false;

function installProtocol() {
  if (protocolInstalled) return;
  setWorkerUrl(`/vendor/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);
  addProtocol("pmtiles", new Protocol().tile);
  protocolInstalled = true;
}

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>';

function styleFor(theme: MapTheme) {
  return basemapStyle({
    theme,
    pmtilesUrl:
      publicEnv.NEXT_PUBLIC_BASEMAP_PMTILES_URL ??
      "/basemap/santiago-rodriguez.pmtiles",
    attribution: ATTRIBUTION,
  });
}

export function MapCanvas({
  bounds,
  center,
  zoom,
  padding,
  interactive = true,
  className,
  label,
  children,
  onReady,
}: {
  bounds?: LngLatBoundsLike;
  center?: LngLatLike;
  zoom?: number;
  padding?: Partial<PaddingOptions>;
  interactive?: boolean;
  className?: string;
  label: string;
  children?: ReactNode;
  onReady?: (map: MapLibreMap) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme: MapTheme = resolvedTheme === "dark" ? "dark" : "light";
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const appliedTheme = useRef<MapTheme>(theme);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  // Created once. The initial view props are read only here on purpose: after
  // mount the camera belongs to the person holding the phone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only
  useEffect(() => {
    if (!container.current) return;
    installProtocol();

    const instance = new MapLibreMap({
      container: container.current,
      style: styleFor(appliedTheme.current),
      bounds,
      center,
      zoom,
      fitBoundsOptions: {
        padding: { top: 24, bottom: 24, left: 24, right: 24, ...padding },
      },
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: [
        [COUNTRY_BOUNDS[0] - 1.5, COUNTRY_BOUNDS[1] - 1],
        [COUNTRY_BOUNDS[2] + 1.5, COUNTRY_BOUNDS[3] + 1],
      ],
      // High-density phones would otherwise shade seven pixels per CSS pixel.
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      interactive,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 180,
      cooperativeGestures: false,
    });
    instance.touchZoomRotate.disableRotation();

    instance.on("style.load", () => setStyleEpoch((epoch) => epoch + 1));
    // Development only: lets screenshot scripts move the camera.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __map?: MapLibreMap }).__map = instance;
    }
    instance.once("load", () => readyRef.current?.(instance));
    setMap(instance);

    return () => {
      instance.remove();
      setMap(null);
    };
  }, []);

  useEffect(() => {
    if (!map || appliedTheme.current === theme) return;
    appliedTheme.current = theme;
    map.setStyle(styleFor(theme), { diff: false });
  }, [map, theme]);

  return (
    <MapContext.Provider value={{ map, styleEpoch, theme }}>
      {/* MapLibre's own stylesheet sets `position: relative` on the element
          it mounts into, unlayered, so it would beat any utility class here.
          The caller positions this wrapper; the map just fills it. */}
      <div className={className}>
        <section ref={container} aria-label={label} className="size-full" />
      </div>
      {map ? children : null}
    </MapContext.Provider>
  );
}

/**
 * Keeps one source and its layers on the map across style swaps, and pushes
 * new data into it without rebuilding anything.
 */
export function useMapLayers({
  id,
  source,
  layers,
  data,
  before,
}: {
  id: string;
  source: SourceSpecification;
  layers: LayerSpecification[];
  data?: GeoJSONValue;
  before?: string;
}) {
  const { map, styleEpoch } = useMapContext();
  const layersKey = JSON.stringify(layers);

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the serialised layers
  useEffect(() => {
    if (!map || styleEpoch === 0) return;
    const parsed = JSON.parse(layersKey) as LayerSpecification[];
    if (!map.getSource(id)) {
      map.addSource(
        id,
        data ? ({ ...source, data } as SourceSpecification) : source,
      );
    }
    for (const layer of parsed) {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id);
      map.addLayer(layer, before && map.getLayer(before) ? before : undefined);
    }
    return () => {
      if (!map.getStyle()) return;
      for (const layer of parsed)
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    };
  }, [map, styleEpoch, id, layersKey, before]);

  useEffect(() => {
    if (!map || styleEpoch === 0 || !data) return;
    const current = map.getSource(id);
    if (
      current &&
      "setData" in current &&
      typeof current.setData === "function"
    ) {
      (current as { setData: (value: GeoJSONValue) => void }).setData(data);
    }
  }, [map, styleEpoch, id, data]);
}

/**
 * A DOM marker whose content is ordinary React, rendered through a portal into
 * the element MapLibre positions. Lets pins use the same tokens, focus rings
 * and transitions as the rest of the interface.
 */
export function MapMarker({
  lngLat,
  children,
  anchor = "center",
  zIndex = 1,
  offset,
}: {
  lngLat: [number, number];
  children: ReactNode;
  anchor?: "center" | "bottom" | "top" | "left" | "right";
  zIndex?: number;
  offset?: [number, number];
}) {
  const { map } = useMapContext();
  const [element] = useState(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );
  const marker = useRef<Marker | null>(null);
  const [lng, lat] = lngLat;

  // Created once per anchor; the position is synced by the next effect, and
  // recreating the marker on every move would flicker.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!map || !element) return;
    const instance = new Marker({ element, anchor, offset })
      .setLngLat([lng, lat])
      .addTo(map);
    marker.current = instance;
    return () => {
      instance.remove();
      marker.current = null;
    };
  }, [map, element, anchor]);

  useEffect(() => {
    marker.current?.setLngLat([lng, lat]);
  }, [lng, lat]);

  const [offsetX, offsetY] = offset ?? [0, 0];
  useEffect(() => {
    marker.current?.setOffset([offsetX, offsetY]);
  }, [offsetX, offsetY]);

  useEffect(() => {
    if (element) element.style.zIndex = String(zIndex);
  }, [element, zIndex]);

  return element ? createPortal(children, element) : null;
}
