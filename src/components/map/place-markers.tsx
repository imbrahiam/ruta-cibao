"use client";

import type { Geometry } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useTranslations } from "next-intl";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CategoryIcon } from "@/components/places/category-icon";
import { cx } from "@/lib/cx";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTERS_SOURCE_LAYER,
  PLACE_LABEL_ZOOM,
  PLACES_SOURCE_ID,
  PLACES_SOURCE_LAYER,
  PLACES_TILE_URL,
} from "@/lib/map/config";
import { MapMarker, useMapContext, useMapLayers } from "./map-core";

export type MapPlace = {
  kind: "place";
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  color: string;
  icon: string | null;
  lng: number;
  lat: number;
  /** Whether and where its name fits without covering another feature. */
  labeled?: boolean;
  labelSide?: "left" | "right";
};

type MapCluster = {
  kind: "cluster";
  key: string;
  count: number;
  lng: number;
  lat: number;
};

type Feature = MapPlace | MapCluster;

/** Individual places become shaped pins once streets begin to separate. */
const PIN_ZOOM = 12.5;

/**
 * Reads the places tile layer and turns what is on screen into features.
 *
 * The tiles are built by Postgres (`ST_AsMVT`); clustering happens there too,
 * below `CLUSTER_MAX_ZOOM`. Two invisible layers make MapLibre fetch those
 * tiles, and the visible pins are DOM elements drawn from them, so they can
 * carry real buttons, focus rings and the same motion as the interface.
 */
function useVisibleFeatures(categories: ReadonlySet<string>) {
  const { map, styleEpoch } = useMapContext();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [zoom, setZoom] = useState(0);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  useMapLayers({
    id: PLACES_SOURCE_ID,
    source: {
      type: "vector",
      tiles: [`${origin}${PLACES_TILE_URL}`],
      minzoom: 0,
      maxzoom: 16,
    },
    layers: [
      {
        id: "places-probe",
        type: "circle",
        source: PLACES_SOURCE_ID,
        "source-layer": PLACES_SOURCE_LAYER,
        paint: { "circle-radius": 1, "circle-opacity": 0 },
      },
      {
        id: "clusters-probe",
        type: "circle",
        source: PLACES_SOURCE_ID,
        "source-layer": CLUSTERS_SOURCE_LAYER,
        paint: { "circle-radius": 1, "circle-opacity": 0 },
      },
    ],
  });

  const categoryKey = [...categories].sort().join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: categories are keyed
  useEffect(() => {
    if (!map || styleEpoch === 0) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setZoom(map.getZoom());
        setFeatures(collect(map, categories));
      });
    };
    const onData = (event: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (event.sourceId === PLACES_SOURCE_ID && event.isSourceLoaded) update();
    };
    map.on("moveend", update);
    map.on("sourcedata", onData);
    update();
    return () => {
      cancelAnimationFrame(frame);
      map.off("moveend", update);
      map.off("sourcedata", onData);
    };
  }, [map, styleEpoch, categoryKey]);

  return { features, zoom };
}

function collect(map: MapLibreMap, categories: ReadonlySet<string>): Feature[] {
  const clustered = Math.floor(map.getZoom()) <= CLUSTER_MAX_ZOOM;
  const raw = map.querySourceFeatures(PLACES_SOURCE_ID, {
    sourceLayer: clustered ? CLUSTERS_SOURCE_LAYER : PLACES_SOURCE_LAYER,
  });
  const bounds = map.getBounds();
  const padLng = (bounds.getEast() - bounds.getWest()) * 0.15;
  const padLat = (bounds.getNorth() - bounds.getSouth()) * 0.15;
  const seen = new Map<string, Feature>();

  for (const feature of raw) {
    const point = pointOf(feature);
    if (!point) continue;
    const [lng, lat] = point;
    if (
      lng < bounds.getWest() - padLng ||
      lng > bounds.getEast() + padLng ||
      lat < bounds.getSouth() - padLat ||
      lat > bounds.getNorth() + padLat
    ) {
      continue;
    }
    const props = feature.properties as Record<string, unknown>;
    const count = typeof props.count === "number" ? props.count : 1;
    const filtered = categories.size > 0;

    if (!clustered || (count === 1 && typeof props.id === "string")) {
      const category = String(props.category ?? "");
      if (filtered && !categories.has(category)) continue;
      const id = String(props.id);
      if (seen.has(id)) continue;
      seen.set(id, {
        kind: "place",
        id,
        slug: String(props.slug),
        name: String(props.name),
        categoryId: category,
        color: String(props.color ?? "#57554f"),
        icon: typeof props.icon === "string" ? props.icon : null,
        lng,
        lat,
      });
      continue;
    }

    // Each cell carries `count:<category>` for every category inside it, so a
    // filter can recount a cluster without another request.
    const visible = filtered
      ? [...categories].reduce((sum, category) => {
          const value = props[`count:${category}`];
          return sum + (typeof value === "number" ? value : 0);
        }, 0)
      : count;
    if (visible === 0) continue;
    const key = `${lng.toFixed(4)}:${lat.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.set(key, { kind: "cluster", key, count: visible, lng, lat });
  }

  const zoom = map.getZoom();
  const radius = clustered ? MERGE_PX : zoom < SEPARATE_ZOOM ? PIN_MERGE_PX : 0;
  let merged = [...seen.values()];
  // A merge moves the cluster to its weighted centre, which can bring it
  // within reach of another marker; repeat until nothing changes.
  for (let pass = 0; radius && pass < 4; pass++) {
    const next = mergeOverlapping(map, merged, radius);
    if (next.length === merged.length) break;
    merged = next;
  }
  return zoom >= PLACE_LABEL_ZOOM ? placeLabels(map, merged) : merged;
}

/** From here up, places are always drawn one by one. */
const SEPARATE_ZOOM = 17;
/** Two pins closer than this would cover each other's icon. */
const PIN_MERGE_PX = 34;

/**
 * Names go under their pins only where they fit: a greedy pass that keeps a
 * label when its box touches no pin and no label already placed. The rest
 * stay icons until the map is closer; tapping one still names it.
 */
function placeLabels(map: MapLibreMap, features: Feature[]): Feature[] {
  const taken: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const overlaps = (box: (typeof taken)[number]) =>
    taken.some(
      (other) =>
        box.x1 < other.x2 &&
        box.x2 > other.x1 &&
        box.y1 < other.y2 &&
        box.y2 > other.y1,
    );
  for (const feature of features) {
    const point = map.project([feature.lng, feature.lat]);
    taken.push({
      x1: point.x - 16,
      y1: point.y - 16,
      x2: point.x + 16,
      y2: point.y + 16,
    });
  }
  return features.map((feature) => {
    if (feature.kind !== "place") return feature;
    const point = map.project([feature.lng, feature.lat]);
    const width = Math.min(184, feature.name.length * 6.6 + 28);
    const roomOnRight = point.x + width + 30 <= map.getCanvas().clientWidth;
    const labelSide = roomOnRight ? "right" : "left";
    const box = {
      x1: roomOnRight ? point.x + 18 : point.x - width - 18,
      y1: point.y - 15,
      x2: roomOnRight ? point.x + width + 18 : point.x - 18,
      y2: point.y + 15,
    };
    if (overlaps(box)) return { ...feature, labeled: false, labelSide };
    taken.push(box);
    return { ...feature, labeled: true, labelSide };
  });
}

/** Closer than this on screen, two markers would touch: they become one cluster. */
const MERGE_PX = 40;

/**
 * The server clusters on a grid, so two cells either side of a line can land
 * a pin's width apart, and a single-place cell drawn as a pin can sit on top
 * of its neighbouring cluster. A greedy pass in screen space folds anything
 * that would overlap into the larger marker, weighted by count.
 */
function mergeOverlapping(
  map: MapLibreMap,
  features: Feature[],
  radius: number,
): Feature[] {
  type Item = { feature: Feature; count: number; x: number; y: number };
  const items: Item[] = features
    .map((feature) => {
      const point = map.project([feature.lng, feature.lat]);
      return {
        feature,
        count: feature.kind === "cluster" ? feature.count : 1,
        x: point.x,
        y: point.y,
      };
    })
    .sort((a, b) => b.count - a.count);
  const kept: Item[] = [];
  for (const item of items) {
    const near = kept.find(
      (other) => Math.hypot(other.x - item.x, other.y - item.y) < radius,
    );
    if (!near) {
      kept.push(item);
      continue;
    }
    const total = near.count + item.count;
    const lng =
      (near.feature.lng * near.count + item.feature.lng * item.count) / total;
    const lat =
      (near.feature.lat * near.count + item.feature.lat * item.count) / total;
    near.feature = {
      kind: "cluster",
      key: `${lng.toFixed(4)}:${lat.toFixed(4)}`,
      count: total,
      lng,
      lat,
    };
    near.count = total;
  }
  return kept.map((item) => item.feature);
}

function pointOf(feature: { geometry: Geometry }): [number, number] | null {
  return feature.geometry.type === "Point"
    ? (feature.geometry.coordinates as [number, number])
    : null;
}

export function PlaceMarkers({
  categories,
  selectedSlug,
  selectedFallback,
  onSelect,
}: {
  categories: ReadonlySet<string>;
  selectedSlug: string | null;
  /** The open place, for when its own pin is clustered away or filtered out. */
  selectedFallback: MapPlace | null;
  onSelect: (place: MapPlace) => void;
}) {
  const { map } = useMapContext();
  const { features, zoom } = useVisibleFeatures(categories);
  const t = useTranslations("map");

  const selectedVisible = useMemo(
    () =>
      features.some(
        (feature) => feature.kind === "place" && feature.slug === selectedSlug,
      ),
    [features, selectedSlug],
  );

  return (
    <>
      {features.map((feature) =>
        feature.kind === "cluster" ? (
          <MapMarker
            key={feature.key}
            lngLat={[feature.lng, feature.lat]}
            zIndex={6}
          >
            <button
              type="button"
              aria-label={t("cluster", { count: feature.count })}
              onClick={() =>
                map?.easeTo({
                  center: [feature.lng, feature.lat],
                  zoom: Math.min(map.getZoom() + 2, SEPARATE_ZOOM + 0.5),
                  duration: 520,
                })
              }
              className="map-pop press flex h-8 min-w-8 items-center justify-center rounded-full bg-accent px-2.5 font-mono text-[12px] font-semibold text-on-accent tabular shadow-md ring-4 ring-accent-soft/80 hover:bg-accent-hover"
              style={{
                scale:
                  feature.count >= 25 ? 1.2 : feature.count >= 8 ? 1.08 : 1,
              }}
            >
              {feature.count}
            </button>
          </MapMarker>
        ) : (
          <MapMarker
            key={feature.id}
            lngLat={[feature.lng, feature.lat]}
            anchor={
              zoom >= PIN_ZOOM || feature.slug === selectedSlug
                ? "bottom"
                : "center"
            }
            zIndex={feature.slug === selectedSlug ? 20 : 2}
          >
            <PlacePin
              place={feature}
              selected={feature.slug === selectedSlug}
              zoom={zoom}
              showName={
                selectedSlug === null &&
                zoom >= PLACE_LABEL_ZOOM &&
                feature.labeled !== false
              }
              onSelect={onSelect}
            />
          </MapMarker>
        ),
      )}
      {selectedFallback && !selectedVisible ? (
        <MapMarker
          key={`selected-${selectedFallback.id}`}
          lngLat={[selectedFallback.lng, selectedFallback.lat]}
          anchor="bottom"
          zIndex={20}
        >
          <PlacePin
            place={selectedFallback}
            selected
            zoom={zoom}
            showName
            onSelect={onSelect}
          />
        </MapMarker>
      ) : null}
    </>
  );
}

function PlacePin({
  place,
  selected,
  zoom,
  showName,
  onSelect,
}: {
  place: MapPlace;
  selected: boolean;
  zoom: number;
  showName: boolean;
  onSelect: (place: MapPlace) => void;
}) {
  const style = { "--marker-color": place.color } as CSSProperties;
  const select = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect(place);
  };

  if (zoom < PIN_ZOOM && !selected) {
    return (
      <button
        type="button"
        aria-label={place.name}
        onClick={select}
        className="map-pop group flex size-11 items-center justify-center outline-none"
        style={style}
      >
        <span className="size-2.5 rounded-full bg-[var(--marker-color)] shadow-sm ring-[3px] ring-card transition-transform group-hover:scale-125 group-focus-visible:ring-accent" />
      </button>
    );
  }

  const labelSide = place.labelSide ?? "right";
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={place.name}
      onClick={select}
      className="map-pop group relative flex h-12 w-11 items-start justify-center outline-none"
      style={style}
    >
      <span
        className={cx(
          "relative flex size-8 items-center justify-center rounded-full shadow-md ring-[3px] ring-card transition-[transform,background-color,box-shadow] duration-[260ms] ease-out after:absolute after:top-[calc(100%-1px)] after:left-1/2 after:h-2 after:w-1.5 after:-translate-x-1/2 after:rounded-b-full after:bg-[var(--marker-color)] group-hover:-translate-y-0.5 group-focus-visible:ring-accent",
          selected
            ? "scale-110 bg-[var(--marker-color)] text-white shadow-lg"
            : "bg-[color-mix(in_srgb,var(--marker-color)_14%,white)] text-[var(--marker-color)]",
        )}
      >
        <CategoryIcon icon={place.icon} className="size-4" />
      </span>
      {selected || showName ? (
        <span
          className={cx(
            "pointer-events-none absolute top-1 flex h-7 max-w-44 items-center gap-1.5 rounded-full bg-card px-2.5 text-[12px] leading-none font-medium whitespace-nowrap text-ink shadow-sm ring-1 ring-line/70",
            labelSide === "right"
              ? "left-[calc(100%-2px)]"
              : "right-[calc(100%-2px)]",
          )}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--marker-color)]" />
          <span className="truncate">{place.name}</span>
        </span>
      ) : null}
    </button>
  );
}
