"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapMarker,
  useMapContext,
  useMapLayers,
} from "@/components/map/map-core";
import { CategoryIcon } from "@/components/places/category-icon";
import { useRealtime } from "@/hooks/use-realtime";
import { cx } from "@/lib/cx";
import { STREET_ZOOM } from "@/lib/map/config";
import { MAP_PALETTES } from "@/lib/map/palette";
import { TRAFFIC_COLORS, trafficTone } from "@/lib/map/traffic-colors";
import { type client, orpc } from "@/lib/orpc";

export type TrafficReport = Awaited<
  ReturnType<typeof client.traffic.active>
>[number];

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

type Box = { west: number; south: number; east: number; north: number };

/** The viewport, rounded so a small pan reuses the last answer. */
function useViewportBox(): Box | null {
  const { map } = useMapContext();
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const bounds = map.getBounds();
      const round = (value: number, up: boolean) =>
        (up ? Math.ceil(value * 50) : Math.floor(value * 50)) / 50;
      setBox({
        west: round(bounds.getWest(), false),
        south: round(bounds.getSouth(), false),
        east: round(bounds.getEast(), true),
        north: round(bounds.getNorth(), true),
      });
    };
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [map]);
  return box;
}

/**
 * What neighbours say about the roads, drawn on the scale every driver reads:
 * red do not go, amber slowly, a lighter amber worth knowing, green open
 * again. A stretch is drawn along the road on a casing the colour of a card;
 * a point gets a chip with its category's icon. Minor reports are dashed, so
 * the difference from "passable" never rests on hue alone.
 */
export function TrafficLayer({
  selectedId,
  onSelect,
  onData,
}: {
  selectedId: string | null;
  onSelect: (report: TrafficReport) => void;
  /** The latest reports in view, so an open report shows fresh counts. */
  onData?: (reports: TrafficReport[]) => void;
}) {
  const { theme, map } = useMapContext();
  const t = useTranslations("traffic");
  const queryClient = useQueryClient();
  const box = useViewportBox();
  // Below street level a report is a dot, so it marks the spot without
  // covering a cluster's count; at street level it becomes the full chip.
  const [compact, setCompact] = useState(true);
  useEffect(() => {
    if (!map) return;
    const update = () => setCompact(map.getZoom() < STREET_ZOOM);
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);
  const p = MAP_PALETTES[theme];

  const query = useQuery({
    ...orpc.traffic.active.queryOptions({
      input: {
        ...(box ?? { west: -72, south: 17, east: -68, north: 21 }),
        limit: 200,
      },
    }),
    enabled: box !== null,
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  useRealtime({
    channels: ["traffic"],
    onEvent: () =>
      queryClient.invalidateQueries({ queryKey: orpc.traffic.key() }),
  });

  const reports = query.data ?? [];
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  useEffect(() => {
    if (query.data) onDataRef.current?.(query.data);
  }, [query.data]);

  const lines = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: reports
        .filter((report) => report.path && report.path.length > 1)
        .map((report) => ({
          type: "Feature",
          properties: {
            id: report.id,
            tone: trafficTone(report.state, report.severity),
            selected: report.id === selectedId,
          },
          geometry: {
            type: "LineString",
            coordinates: (report.path ?? []).map((point) => [
              point.lng,
              point.lat,
            ]),
          },
        })),
    }),
    [reports, selectedId],
  );

  const color = [
    "match",
    ["get", "tone"],
    "blocking",
    TRAFFIC_COLORS.blocking,
    "partial",
    TRAFFIC_COLORS.partial,
    "minor",
    TRAFFIC_COLORS.minor,
    TRAFFIC_COLORS.cleared,
  ] as const;

  useMapLayers({
    id: "traffic-lines",
    source: { type: "geojson", data: EMPTY },
    data: lines,
    layers: [
      {
        id: "traffic-casing",
        type: "line",
        source: "traffic-lines",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": p.card,
          "line-width": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            10,
            ["case", ["get", "selected"], 7, 5],
            16,
            ["case", ["get", "selected"], 17, 13],
          ],
        },
      },
      {
        id: "traffic-line",
        type: "line",
        source: "traffic-lines",
        filter: ["!=", ["get", "tone"], "minor"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": color as unknown as string,
          "line-width": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            10,
            3,
            16,
            8,
          ],
          "line-opacity": ["case", ["==", ["get", "tone"], "cleared"], 0.85, 1],
        },
      },
      {
        id: "traffic-line-minor",
        type: "line",
        source: "traffic-lines",
        filter: ["==", ["get", "tone"], "minor"],
        layout: { "line-join": "round" },
        paint: {
          "line-color": TRAFFIC_COLORS.minor,
          "line-width": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            10,
            3,
            16,
            8,
          ],
          "line-dasharray": [1.4, 1.1],
        },
      },
    ],
  });

  // Cleared roads are information, not something to act on: no marker.
  const markers = reports.filter((report) => report.state === "active");

  return (
    <>
      {markers.map((report) => {
        const tone = trafficTone(report.state, report.severity);
        const selected = report.id === selectedId;
        return (
          <MapMarker
            key={report.id}
            lngLat={[report.lng, report.lat]}
            zIndex={selected ? 25 : 7}
            offset={compact && !selected ? [13, -13] : undefined}
          >
            <button
              type="button"
              aria-label={t("markerLabel", {
                category: report.categoryName,
                tone: t(`tones.${tone}`),
              })}
              aria-pressed={selected}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(report);
              }}
              className="map-pop group flex size-11 items-center justify-center outline-none"
            >
              <span
                className={cx(
                  "flex items-center justify-center text-white shadow-md ring-2 ring-card transition-[transform,width,height,border-radius] duration-[260ms] ease-out group-hover:-translate-y-0.5 group-focus-visible:ring-accent",
                  compact && !selected
                    ? "size-3.5 rounded-full [&>svg]:hidden"
                    : "size-7 rounded-[9px]",
                  selected && "scale-[1.3] shadow-lg",
                )}
                style={{ backgroundColor: TRAFFIC_COLORS[tone] }}
              >
                <CategoryIcon
                  icon={report.categoryIcon}
                  className="size-3.5"
                  strokeWidth={2}
                />
              </span>
            </button>
          </MapMarker>
        );
      })}
    </>
  );
}
