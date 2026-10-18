"use client";

import type { Feature, FeatureCollection } from "geojson";
import { useMemo } from "react";
import { useBoundaries } from "@/hooks/use-boundaries";
import { MAP_FONTS, MAP_PALETTES } from "@/lib/map/palette";
import { useMapContext, useMapLayers } from "./map-core";

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * The province as the subject: everything outside it is veiled with paper,
 * labels included, so a town across the border reads as context rather than
 * as a destination. Its edge is drawn in ink, the three municipalities divided by a dashed line
 * and named in the mono label face. The veil lifts at street level, where
 * crossing into Valverde or Dajabón is just the next block.
 */
export function ProvinceLayers() {
  const { theme } = useMapContext();
  const { data } = useBoundaries();
  const p = MAP_PALETTES[theme];

  const shapes = useMemo<FeatureCollection>(() => {
    if (!data) return EMPTY;
    const features: Feature[] = data.features.map((feature) => ({
      type: "Feature",
      properties: { role: "municipality", name: feature.properties.name },
      geometry: feature.geometry,
    }));
    if (data.outside) {
      features.push({
        type: "Feature",
        properties: { role: "outside" },
        geometry: data.outside,
      });
    }
    return { type: "FeatureCollection", features };
  }, [data]);

  const labels = useMemo<FeatureCollection>(() => {
    if (!data) return EMPTY;
    return {
      type: "FeatureCollection",
      features: data.features
        .filter((feature) => feature.properties.label)
        .map((feature) => ({
          type: "Feature",
          properties: { name: feature.properties.name },
          geometry: {
            type: "Point",
            coordinates: feature.properties.label as [number, number],
          },
        })),
    };
  }, [data]);

  useMapLayers({
    id: "province",
    source: { type: "geojson", data: EMPTY },
    data: shapes,
    layers: [
      {
        id: "province-veil",
        type: "fill",
        source: "province",
        filter: ["==", ["get", "role"], "outside"],
        paint: {
          "fill-color": p.veil,
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            p.veilOpacity,
            15,
            0,
          ],
        },
      },
      {
        id: "province-municipal-line",
        type: "line",
        source: "province",
        filter: ["==", ["get", "role"], "municipality"],
        layout: { "line-join": "round" },
        paint: {
          "line-color": p.municipalLine,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 14, 1.4],
          "line-dasharray": [2, 2],
          "line-opacity": 0.8,
        },
      },
      {
        id: "province-outline",
        type: "line",
        source: "province",
        filter: ["==", ["get", "role"], "outside"],
        layout: { "line-join": "round" },
        paint: {
          "line-color": p.outline,
          "line-opacity": 0.42,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.2, 14, 2.2],
        },
      },
    ],
  });

  useMapLayers({
    id: "province-labels",
    source: { type: "geojson", data: EMPTY },
    data: labels,
    layers: [
      {
        id: "province-municipality-name",
        type: "symbol",
        source: "province-labels",
        maxzoom: 12.5,
        layout: {
          "text-field": ["upcase", ["get", "name"]],
          "text-font": [...MAP_FONTS.mono],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 10.5, 12, 12],
          "text-letter-spacing": 0.16,
          "text-max-width": 9,
          "text-allow-overlap": false,
          "text-padding": 12,
        },
        paint: {
          "text-color": p.label2,
          "text-halo-color": p.halo,
          "text-halo-width": 1.6,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            11.5,
            1,
            12.5,
            0,
          ],
        },
      },
    ],
  });

  return null;
}
