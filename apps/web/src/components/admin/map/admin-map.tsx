"use client";

import { Layers, Maximize, Minus, Plus } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  createMarkerOverlay,
  loadGoogleMaps,
  type MapsFailure,
  MapsUnavailableError,
  type MarkerOverlay,
  onMapsAuthFailure,
} from "./google-maps";
import { MapFallback } from "./map-fallback";
import {
  MAP_STYLE_IDS,
  type MapStyleId,
  mapBackground,
  mapStyle,
} from "./map-style";
import {
  type ContextPoint,
  itemMarkerPoint,
  itemPoints,
  type LatLng,
  type MapItem,
} from "./map-types";
import { ContextDot, GlyphMarker, RouteEndMarker } from "./markers";
import { MAP_INK, type Scheme } from "./palette";
import { framingFor, roadWeight } from "./road-stretch";
import { stretchColor } from "./stretch-color";
import {
  createStretchOverlay,
  type StretchOverlay,
  type StretchStyle,
} from "./stretch-overlay";
import { useColorScheme } from "./use-color-scheme";
import { BASE_MAPS, type BaseMap, useMapChoice } from "./use-map-choice";
import { useSnappedItems } from "./use-snapped-path";

/** Under this span (about 60 m) a view is centred on the spot, not fitted. */
const TINY_SPAN = 0.0006;

/** Neighbouring places are orientation at street scale, noise at province scale. */
const CONTEXT_MIN_ZOOM = 14;

/** A stretch is framed to fill this much of the frame's short side. */
const STRETCH_FILL = 0.7;

const MARKER_SIZE = 28;
const PLACE_SIZE = 26;

type Props = {
  items: MapItem[];
  /** Faint neighbours for orientation; only worth passing to a large map. */
  context?: ContextPoint[];
  /**
   * The text alternative: what this map shows, in a sentence. A static map is
   * exposed as one image with this name; an interactive one is a group
   * described by it.
   */
  label: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /**
   * Interactive maps pan, zoom, switch to satellite and select items. A static
   * one is a picture (a row's thumbnail) that something else makes clickable.
   */
  interactive?: boolean;
  /** Sizing: an aspect ratio or a height. The map fills its box. */
  className?: string;
  /** Drawn above the map while it works (the thumbnail's expand button). */
  overlay?: ReactNode;
};

/**
 * The staff desk's map: Google Maps drawn with the phone app's palette.
 *
 * Loaded on first mount only, so pages without a map never ask Google for
 * anything. While it loads it is a skeleton of the final size; if it cannot be
 * drawn (no key, key rejected, offline) it becomes the coordinates and links
 * for the same items.
 */
export function AdminMap({
  items,
  context = [],
  label,
  selectedId = null,
  onSelect,
  interactive = false,
  className,
  overlay,
}: Props) {
  const t = useTranslations("admin.queue.map");
  const q = useTranslations("admin.queue");
  const scheme = useColorScheme();
  const host = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<MapsFailure | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [{ base, style: look }, setChoice] = useMapChoice();
  const [zoomed, setZoomed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Stretches drawn on Google's road: the reported path at first, the road
  // once the server has laid it there. Fitting and markers use what is drawn.
  const shown = useSnappedItems(items);

  // What effects read without re-running when it changes identity.
  const latest = useRef({ items: shown, interactive });
  latest.current = { items: shown, interactive };
  const touched = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the load after a retry
  useEffect(() => {
    let alive = true;
    loadGoogleMaps().then(
      () => alive && setLoaded(true),
      (error) =>
        alive &&
        setFailure(
          error instanceof MapsUnavailableError ? error.reason : "blocked",
        ),
    );
    const stop = onMapsAuthFailure(() => alive && setFailure("blocked"));
    return () => {
      alive = false;
      stop();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((count) => count + 1);
  }, []);

  // A script that could not load (offline, blocked for a moment) is tried
  // again as soon as the network is back.
  useEffect(() => {
    if (failure !== "blocked") return;
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [failure, retry]);

  // The basemap: the chosen style on the road map, plain imagery for
  // satellite. Road fill is painted at one weight per zoom level
  // (`mapStyle`), so it is restyled the moment the zoom crosses a level, in
  // step with the stretch lines drawn over it. Nothing is restyled while the
  // key is unchanged.
  const basemap = useRef({ base, look, scheme });
  basemap.current = { base, look, scheme };
  const painted = useRef("");
  const paint = useCallback((instance: google.maps.Map) => {
    const { base: type, look: id, scheme: colours } = basemap.current;
    const zoom = instance.getZoom() ?? 15;
    const key = `${type}:${id}:${colours}:${type === "map" ? roadWeight(zoom) : 0}`;
    if (painted.current === key) return;
    painted.current = key;
    instance.setOptions({
      styles: type === "map" ? mapStyle(id, colours, zoom) : [],
      backgroundColor: mapBackground(id, colours),
    });
    instance.setMapTypeId(type === "map" ? "roadmap" : "hybrid");
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!loaded || !element || failure) return;
    const first = latest.current.items[0];
    const start = first ? itemPoints(first)[0] : undefined;
    const instance = new google.maps.Map(element, {
      center: start ?? { lat: 19.47, lng: -71.33 },
      zoom: 15,
      disableDefaultUI: true,
      clickableIcons: false,
      keyboardShortcuts: interactive,
      gestureHandling: interactive ? "greedy" : "none",
      backgroundColor: mapBackground(
        basemap.current.look,
        basemap.current.scheme,
      ),
      mapTypeId: "roadmap",
    });
    touched.current = false;
    painted.current = "";
    const once = instance.addListener("idle", () => {
      once.remove();
      setZoomed((instance.getZoom() ?? 0) >= CONTEXT_MIN_ZOOM);
      setReady(true);
    });
    const touch = () => {
      touched.current = true;
    };
    instance.addListener("dragstart", touch);
    instance.addListener("zoom_changed", () => {
      setZoomed((instance.getZoom() ?? 0) >= CONTEXT_MIN_ZOOM);
      paint(instance);
    });
    setMap(instance);
    return () => {
      google.maps.event.clearInstanceListeners(instance);
      element.replaceChildren();
      setMap(null);
      setReady(false);
    };
  }, [loaded, failure, interactive, paint]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `paint` reads `base`, `look` and `scheme` through a ref; a change of any re-runs it
  useEffect(() => {
    if (map) paint(map);
  }, [map, base, look, scheme, paint]);

  const fit = useCallback(() => {
    if (!map) return;
    const points = latest.current.items.flatMap(itemPoints);
    if (points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const point of points) bounds.extend(point);
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (
      Math.abs(ne.lat() - sw.lat()) < TINY_SPAN &&
      Math.abs(ne.lng() - sw.lng()) < TINY_SPAN
    ) {
      map.setCenter(bounds.getCenter());
      map.setZoom(latest.current.interactive ? 17 : 16);
    } else if (!latest.current.interactive && host.current) {
      // The stretch is the picture: it fills most of the frame, centred.
      const frame = framingFor(
        points,
        host.current.clientWidth,
        host.current.clientHeight,
        STRETCH_FILL,
      );
      if (frame) {
        map.setCenter(frame.center);
        map.setZoom(frame.zoom);
      }
    } else {
      map.fitBounds(bounds, 64);
    }
  }, [map]);

  // Refit when what is drawn changes (a decided item leaves) or the box does,
  // until somebody has moved the map themselves.
  const fitKey = items
    .map((item) => `${item.id}:${itemPoints(item).length}`)
    .join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: fitKey stands for `items`
  useEffect(() => {
    fit();
  }, [fit, fitKey]);

  useEffect(() => {
    const element = host.current;
    if (!map || !element) return;
    const observer = new ResizeObserver(() => {
      if (!touched.current) fit();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [map, fit]);

  // Selecting a row brings its item into view.
  useEffect(() => {
    if (!map || selectedId === null) return;
    const item = latest.current.items.find((entry) => entry.id === selectedId);
    if (!item) return;
    const points = itemPoints(item);
    const view = map.getBounds();
    const inView = view ? points.every((point) => view.contains(point)) : false;
    if (points.length > 1) {
      // In view is not enough when the whole stretch is a few pixels long.
      const frame = host.current
        ? framingFor(
            points,
            host.current.clientWidth,
            host.current.clientHeight,
            STRETCH_FILL,
          )
        : null;
      const tiny = frame ? (map.getZoom() ?? 0) < frame.zoom - 2 : false;
      if (inView && !tiny) return;
      const bounds = new google.maps.LatLngBounds();
      for (const point of points) bounds.extend(point);
      map.fitBounds(bounds, 64);
      return;
    }
    const point = points[0];
    if (!point) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm) map.setCenter(point);
    else map.panTo(point);
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15);
  }, [map, selectedId]);

  const select = interactive && onSelect ? onSelect : undefined;
  const drawn = map && !failure;

  return (
    <div
      {...(failure
        ? {}
        : { role: interactive ? "group" : "img", "aria-label": label })}
      className={cn(
        "relative isolate overflow-hidden rounded-(--radius-field) border bg-muted",
        className,
      )}
    >
      {failure ? (
        <MapFallback
          items={items}
          reason={failure}
          onRetry={retry}
          compact={!interactive}
        />
      ) : (
        <>
          {/* A static map is a picture: nothing inside it takes focus. */}
          <div
            ref={host}
            inert={!interactive}
            className="absolute inset-0"
            aria-hidden={interactive ? undefined : true}
          />
          {!ready ? (
            <div role="status" className="absolute inset-0">
              <Skeleton className="size-full rounded-none" />
              <span className="sr-only">{t("loading")}</span>
            </div>
          ) : null}
          {drawn && zoomed
            ? context.map((point) => (
                <OverlayMarker
                  key={`context-${point.id}`}
                  map={map}
                  position={point}
                  zIndex={1}
                >
                  <ContextDot scheme={scheme} />
                </OverlayMarker>
              ))
            : null}
          {drawn
            ? shown.map((item) => (
                <StretchLine
                  key={`line-${item.id}`}
                  map={map}
                  item={item}
                  scheme={scheme}
                  look={base === "map" ? look : null}
                  selected={item.id === selectedId}
                  onSelect={select ? () => select(item.id) : undefined}
                />
              ))
            : null}
          {drawn
            ? shown.flatMap((item) =>
                markersFor(item, {
                  map,
                  scheme,
                  ends: { start: q("pathStart"), end: q("pathEnd") },
                  selected: item.id === selectedId,
                  onSelect: select ? () => select(item.id) : undefined,
                }),
              )
            : null}
          {ready ? overlay : null}
          {interactive && ready && drawn ? (
            <>
              <MapMenu
                base={base}
                look={look}
                onBase={(next) => setChoice({ base: next })}
                onLook={(next) => setChoice({ style: next, base: "map" })}
              />
              <ZoomControls
                map={map}
                onFit={() => {
                  touched.current = false;
                  fit();
                }}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function markersFor(
  item: MapItem,
  {
    map,
    scheme,
    ends,
    selected,
    onSelect,
  }: {
    map: google.maps.Map;
    scheme: Scheme;
    /** The words for a route's two ends. */
    ends: { start: string; end: string };
    selected: boolean;
    onSelect?: () => void;
  },
): ReactNode[] {
  const z = selected ? 20 : 10;
  if (item.kind === "route") {
    const start = item.path[0];
    const end = item.path[item.path.length - 1];
    if (!start || !end) return [];
    return [
      <OverlayMarker
        key={`${item.id}-start`}
        map={map}
        position={start}
        zIndex={z}
      >
        <RouteEndMarker
          end="start"
          scheme={scheme}
          label={`${item.label}: ${ends.start}`}
          selected={selected}
          onSelect={onSelect}
        />
      </OverlayMarker>,
      <OverlayMarker key={`${item.id}-end`} map={map} position={end} zIndex={z}>
        <RouteEndMarker
          end="end"
          scheme={scheme}
          label={`${item.label}: ${ends.end}`}
          selected={selected}
          onSelect={onSelect}
        />
      </OverlayMarker>,
    ];
  }
  return [
    <OverlayMarker
      key={item.id}
      map={map}
      position={itemMarkerPoint(item)}
      zIndex={z + (item.kind === "traffic" ? 5 : 0)}
    >
      <GlyphMarker
        icon={item.icon}
        color={item.color}
        size={item.kind === "traffic" ? MARKER_SIZE : PLACE_SIZE}
        label={item.label}
        selected={selected}
        onSelect={onSelect}
      />
    </OverlayMarker>,
  ];
}

/** An element pinned on the map whose contents React renders (portalled). */
function OverlayMarker({
  map,
  position,
  zIndex,
  children,
}: {
  map: google.maps.Map;
  position: LatLng;
  zIndex: number;
  children: ReactNode;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const overlay = useRef<MarkerOverlay | null>(null);
  const start = useRef({ position, zIndex });
  start.current = { position, zIndex };

  useEffect(() => {
    const div = document.createElement("div");
    const created = createMarkerOverlay(
      div,
      start.current.position,
      start.current.zIndex,
    );
    created.setMap(map);
    overlay.current = created;
    setElement(div);
    return () => {
      created.setMap(null);
      overlay.current = null;
      setElement(null);
    };
  }, [map]);

  // Moving the marker (a stretch's road arriving) is a redraw, not a new element.
  const { lat, lng } = position;
  useEffect(() => {
    overlay.current?.setPosition({ lat, lng });
  }, [lat, lng]);
  useEffect(() => {
    overlay.current?.setZIndex(zIndex);
  }, [zIndex]);

  return element ? createPortal(children, element) : null;
}

/**
 * A reported stretch or a trail, drawn as one line on the road under the
 * markers. A stretch is severity-coloured (dotted once cleared); a trail is
 * ink. On the road map its colour is adjusted to the style's ground so it
 * keeps 3:1 against road, park and water (`stretchColor`); over satellite
 * imagery (`look` null) there is no known ground and the colour is as given.
 */
function StretchLine({
  map,
  item,
  scheme,
  look,
  selected,
  onSelect,
}: {
  map: google.maps.Map;
  item: MapItem;
  scheme: Scheme;
  look: MapStyleId | null;
  selected: boolean;
  onSelect?: () => void;
}) {
  const overlay = useRef<StretchOverlay | null>(null);
  const path = item.kind === "place" ? null : item.path;
  const ink = MAP_INK[scheme];

  const style = useMemo((): StretchStyle | null => {
    if (item.kind === "place") return null;
    const tint = (color: string) =>
      look ? stretchColor(color, look, scheme) : color;
    if (item.kind === "route") {
      return {
        color: tint(ink.pin),
        pattern: "solid",
        selected,
        zIndex: selected ? 4 : 3,
      };
    }
    return {
      color: tint(item.color),
      pattern: item.kind === "traffic" && item.cleared ? "dots" : "solid",
      selected,
      zIndex: selected ? 4 : 3,
    };
  }, [item, ink, look, scheme, selected]);

  const latest = useRef({ path, style, onSelect });
  latest.current = { path, style, onSelect };
  const drawable = path !== null && path.length > 1;
  // A click is only caught while something can act on it.
  const selectable = onSelect !== undefined;

  useEffect(() => {
    const { path: first, style: initial } = latest.current;
    if (!drawable || !first || !initial) return;
    const created = createStretchOverlay(first, initial);
    created.setMap(map);
    overlay.current = created;
    return () => {
      created.setMap(null);
      overlay.current = null;
    };
  }, [map, drawable]);

  // The road arriving, or a selection, is a redraw of the same element.
  useEffect(() => {
    const current = overlay.current;
    if (!current || !path || !style) return;
    current.onSelect = selectable
      ? () => latest.current.onSelect?.()
      : undefined;
    current.update(path, style);
  }, [path, style, selectable]);

  return null;
}

const CONTROL =
  "bg-card/95 shadow-(--shadow-elevated) backdrop-blur pointer-coarse:size-11";

/**
 * One compact control for what the map shows: its kind (road map or
 * satellite) and, for the road map, its style. The choice is shared by every
 * map on the page and remembered (`useMapChoice`). Picking a style is picking
 * the road map in that style, so no style is marked while satellite is on.
 */
function MapMenu({
  base,
  look,
  onBase,
  onLook,
}: {
  base: BaseMap;
  look: MapStyleId;
  onBase: (next: BaseMap) => void;
  onLook: (next: MapStyleId) => void;
}) {
  const t = useTranslations("admin.queue.map");
  const current =
    base === "satellite" ? t("typeSatellite") : t(`style.${look}`);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="absolute top-2 left-2 z-10 h-8 rounded-full bg-card/95 px-3 shadow-(--shadow-elevated) backdrop-blur pointer-coarse:h-11"
          aria-label={`${t("options")}: ${current}`}
        >
          <Layers aria-hidden />
          {current}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="pointer-coarse:text-base">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("type")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={base}
            onValueChange={(next) => {
              const option = BASE_MAPS.find((entry) => entry === next);
              if (option) onBase(option);
            }}
          >
            {BASE_MAPS.map((option) => (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                className="pointer-coarse:min-h-11"
              >
                {t(option === "map" ? "typeMap" : "typeSatellite")}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("styleLabel")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={base === "map" ? look : ""}
            onValueChange={(next) => {
              const option = MAP_STYLE_IDS.find((entry) => entry === next);
              if (option) onLook(option);
            }}
          >
            {MAP_STYLE_IDS.map((option) => (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                className="pointer-coarse:min-h-11"
              >
                {t(`style.${option}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ZoomControls({
  map,
  onFit,
}: {
  map: google.maps.Map;
  onFit: () => void;
}) {
  const t = useTranslations("admin.queue.map");
  const zoom = (delta: number) => map.setZoom((map.getZoom() ?? 15) + delta);
  return (
    <div className="absolute right-2 bottom-8 z-10 flex flex-col gap-1.5">
      <Button
        variant="outline"
        size="icon"
        className={cn(CONTROL, "pointer-coarse:hidden")}
        aria-label={t("zoomIn")}
        title={t("zoomIn")}
        onClick={() => zoom(1)}
      >
        <Plus aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={cn(CONTROL, "pointer-coarse:hidden")}
        aria-label={t("zoomOut")}
        title={t("zoomOut")}
        onClick={() => zoom(-1)}
      >
        <Minus aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={CONTROL}
        aria-label={t("fit")}
        title={t("fit")}
        onClick={onFit}
      >
        <Maximize aria-hidden />
      </Button>
    </div>
  );
}
