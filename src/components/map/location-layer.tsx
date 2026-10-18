"use client";

import type { Feature, FeatureCollection } from "geojson";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { GeoFix } from "@/hooks/use-geolocation";
import { MAP_PALETTES } from "@/lib/map/palette";
import { MapMarker, useMapContext, useMapLayers } from "./map-core";

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/** A circle of `meters` around a point, as a 48-sided polygon. */
function circle(lng: number, lat: number, meters: number): Feature {
  const points: [number, number][] = [];
  const latRadius = meters / 111_320;
  const lngRadius = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let step = 0; step <= 48; step++) {
    const angle = (step / 48) * Math.PI * 2;
    points.push([
      lng + lngRadius * Math.cos(angle),
      lat + latRadius * Math.sin(angle),
    ]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [points] },
  };
}

/**
 * "You are here": the blue every phone map taught people, a white ring so it
 * stands off any ground, and the accuracy drawn as a pale disc so a 300 m fix
 * never looks like a 5 m one. The ripple plays once, when the fix arrives.
 */
export function LocationLayer({ fix }: { fix: GeoFix | null }) {
  const { theme } = useMapContext();
  const t = useTranslations("map");
  const p = MAP_PALETTES[theme];

  const accuracy = useMemo<FeatureCollection>(
    () =>
      fix
        ? {
            type: "FeatureCollection",
            features: [circle(fix.lng, fix.lat, Math.min(fix.accuracy, 2000))],
          }
        : EMPTY,
    [fix],
  );

  useMapLayers({
    id: "my-location",
    source: { type: "geojson", data: EMPTY },
    data: accuracy,
    layers: [
      {
        id: "my-location-accuracy",
        type: "fill",
        source: "my-location",
        paint: { "fill-color": p.locate, "fill-opacity": 0.1 },
      },
      {
        id: "my-location-accuracy-edge",
        type: "line",
        source: "my-location",
        paint: {
          "line-color": p.locate,
          "line-opacity": 0.35,
          "line-width": 1,
        },
      },
    ],
  });

  if (!fix) return null;

  return (
    <MapMarker lngLat={[fix.lng, fix.lat]} zIndex={10}>
      <span
        role="img"
        aria-label={t("youAreHere")}
        className="relative flex size-5 items-center justify-center"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-locate motion-safe:animate-[locate-ring_1.4s_var(--ease-out)_2]"
          style={{ opacity: 0 }}
        />
        <span className="size-[18px] rounded-full bg-locate shadow-md ring-[3px] ring-white" />
      </span>
    </MapMarker>
  );
}
