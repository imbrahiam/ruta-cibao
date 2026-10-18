"use client";

import type { FeatureCollection } from "geojson";
import type { LngLatBoundsLike, MapMouseEvent } from "maplibre-gl";
import { useEffect, useMemo } from "react";
import {
  MapCanvas,
  useMapContext,
  useMapLayers,
} from "@/components/map/map-core";
import { ProvinceLayers } from "@/components/map/province-layers";
import { PROVINCE_BOUNDS } from "@/lib/map/config";
import { MAP_PALETTES } from "@/lib/map/palette";

type Point = { lng: number; lat: number };

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

function boundsOf(path: Point[]): LngLatBoundsLike {
  if (path.length === 0) {
    const [west, south, east, north] = PROVINCE_BOUNDS;
    return [
      [west, south],
      [east, north],
    ];
  }
  const lngs = path.map((point) => point.lng);
  const lats = path.map((point) => point.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

function RouteLine({ path, draft }: { path: Point[]; draft: boolean }) {
  const { theme } = useMapContext();
  const p = MAP_PALETTES[theme];
  const data = useMemo<FeatureCollection>(
    () =>
      path.length === 0
        ? EMPTY
        : {
            type: "FeatureCollection",
            features: [
              ...(path.length > 1
                ? [
                    {
                      type: "Feature" as const,
                      properties: { role: "line" },
                      geometry: {
                        type: "LineString" as const,
                        coordinates: path.map((point) => [
                          point.lng,
                          point.lat,
                        ]),
                      },
                    },
                  ]
                : []),
              ...path.map((point, index) => ({
                type: "Feature" as const,
                properties: {
                  role:
                    index === 0
                      ? "start"
                      : index === path.length - 1
                        ? "end"
                        : "vertex",
                },
                geometry: {
                  type: "Point" as const,
                  coordinates: [point.lng, point.lat],
                },
              })),
            ],
          },
    [path],
  );

  useMapLayers({
    id: "route-line",
    source: { type: "geojson", data: EMPTY },
    data,
    layers: [
      {
        id: "route-line-casing",
        type: "line",
        source: "route-line",
        filter: ["==", ["get", "role"], "line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.card, "line-width": 9 },
      },
      {
        id: "route-line-stroke",
        type: "line",
        source: "route-line",
        filter: ["==", ["get", "role"], "line"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.accent, "line-width": 4.5 },
      },
      {
        id: "route-line-points",
        type: "circle",
        source: "route-line",
        filter: draft
          ? ["!=", ["get", "role"], "line"]
          : ["in", ["get", "role"], ["literal", ["start", "end"]]],
        paint: {
          "circle-radius": ["match", ["get", "role"], "vertex", 3.5, 6],
          "circle-color": ["match", ["get", "role"], "end", p.accent, p.card],
          "circle-stroke-color": p.accent,
          "circle-stroke-width": 2.5,
        },
      },
    ],
  });
  return null;
}

function TapToAdd({ onAdd }: { onAdd: (point: Point) => void }) {
  const { map } = useMapContext();
  useEffect(() => {
    if (!map) return;
    const click = (event: MapMouseEvent) =>
      onAdd({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    map.on("click", click);
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      map.off("click", click);
    };
  }, [map, onAdd]);
  return null;
}

/** A route on its own small map: the line in the accent, start hollow, end filled. */
export function RouteMap({
  path,
  label,
  className,
  onAdd,
}: {
  path: Point[];
  label: string;
  className?: string;
  /** When set, the map is a drawing surface: each tap adds a point. */
  onAdd?: (point: Point) => void;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: framed once on mount
  const bounds = useMemo(() => boundsOf(path), []);
  return (
    <MapCanvas
      label={label}
      bounds={bounds}
      padding={{ top: 40, bottom: 40, left: 40, right: 40 }}
      className={className}
    >
      <ProvinceLayers />
      <RouteLine path={path} draft={Boolean(onAdd)} />
      {onAdd ? <TapToAdd onAdd={onAdd} /> : null}
    </MapCanvas>
  );
}
