"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { Footprints, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { Link } from "@/i18n/navigation";
import { MAP_PALETTES } from "@/lib/map/palette";
import { orpc } from "@/lib/orpc";
import { MapMarker, useMapContext, useMapLayers } from "./map-core";

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Ecotourism routes as dashed trails in their category's colour, with a mark
 * where each one starts, and open citizen cases as speech marks where they
 * were filed. Both link to their own pages rather than opening another sheet:
 * a route and a case each have more to say than a map panel holds.
 */
export function CommunityLayer({
  showRoutes,
  showCases,
}: {
  showRoutes: boolean;
  showCases: boolean;
}) {
  const { map, theme } = useMapContext();
  const t = useTranslations("map.community");
  const queryClient = useQueryClient();
  const p = MAP_PALETTES[theme];
  const [box, setBox] = useState<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      const bounds = map.getBounds();
      setBox({
        west: Math.floor(bounds.getWest() * 20) / 20,
        south: Math.floor(bounds.getSouth() * 20) / 20,
        east: Math.ceil(bounds.getEast() * 20) / 20,
        north: Math.ceil(bounds.getNorth() * 20) / 20,
      });
    };
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [map]);

  const query = useQuery({
    ...orpc.routes.map.queryOptions({
      input: box ?? { west: -72, south: 17, east: -68, north: 21 },
    }),
    enabled: box !== null && (showRoutes || showCases),
    placeholderData: (previous) => previous,
  });

  useRealtime({
    channels: ["routes", "consultations"],
    enabled: showRoutes || showCases,
    onEvent: () =>
      queryClient.invalidateQueries({ queryKey: orpc.routes.map.key() }),
  });

  const features = query.data?.features ?? [];
  const routes = showRoutes
    ? features.filter((feature) => feature.kind === "route")
    : [];
  const cases = showCases
    ? features.filter((feature) => feature.kind === "consultation")
    : [];

  const lines = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: routes
        .filter((route) => route.path && route.path.length > 1)
        .map((route) => ({
          type: "Feature",
          properties: { color: route.color },
          geometry: {
            type: "LineString",
            coordinates: (route.path ?? []).map((point) => [
              point.lng,
              point.lat,
            ]),
          },
        })),
    }),
    [routes],
  );

  useMapLayers({
    id: "community-routes",
    source: { type: "geojson", data: EMPTY },
    data: lines,
    layers: [
      {
        id: "community-route-casing",
        type: "line",
        source: "community-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": p.card,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 4, 16, 9],
        },
      },
      {
        id: "community-route-line",
        type: "line",
        source: "community-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 16, 5],
          "line-dasharray": [2, 1.2],
        },
      },
    ],
  });

  return (
    <>
      {routes.map((route) => (
        <MapMarker
          key={`route-${route.id}`}
          lngLat={[route.lng, route.lat]}
          zIndex={4}
        >
          <Link
            href={route.href as "/rutas"}
            aria-label={t("route", { name: route.title })}
            className="map-pop group flex size-11 items-center justify-center"
          >
            <span
              className="flex size-7 items-center justify-center rounded-full text-white shadow-md ring-2 ring-card transition-transform group-hover:-translate-y-0.5"
              style={{ backgroundColor: route.color }}
            >
              <Footprints strokeWidth={2} className="size-3.5" />
            </span>
          </Link>
        </MapMarker>
      ))}
      {cases.map((item) => (
        <MapMarker
          key={`case-${item.id}`}
          lngLat={[item.lng, item.lat]}
          zIndex={3}
        >
          <Link
            href={item.href as "/consultas"}
            aria-label={t("case", { title: item.title })}
            className="map-pop group flex size-11 items-center justify-center"
          >
            <span className="flex size-7 items-center justify-center rounded-full rounded-bl-[4px] bg-card text-ink-2 shadow-md ring-1 ring-line transition-transform group-hover:-translate-y-0.5">
              <MessagesSquare
                strokeWidth={1.75}
                className="size-3.5"
                style={{ color: item.color }}
              />
            </span>
          </Link>
        </MapMarker>
      ))}
    </>
  );
}
