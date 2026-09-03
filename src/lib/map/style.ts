import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { mapPalette } from "./palette";

/**
 * Builds the map style.
 *
 * Three basemap sources, chosen by configuration rather than by code changes:
 *
 *   `pmtiles`   a single self-hosted file covering the province. The handover
 *               path — no key, no bill, no third party, and it works offline.
 *   `maptiler`  hosted vector tiles, restyled below. Convenient for the demo.
 *   `none`      no basemap at all. Not a failure mode: the citizen layer still
 *               renders on a clean ground, which is what a development machine
 *               with no keys and no signal gets.
 *
 * Whatever the source, the styling is ours. A stock basemap would drag in the
 * colours and label density of a general-purpose map, and this one has a single
 * job: disappear behind what the province puts on it.
 *
 * Pure data. React Native hands the same object to MapLibre Native.
 */
export type BasemapSource =
  | { kind: "pmtiles"; url: string }
  | { kind: "maptiler"; key: string }
  | { kind: "none" };

const OPENMAPTILES = "basemap";

/** The vector schema both MapTiler and Protomaps' OpenMapTiles builds share. */
function basemapLayers(): LayerSpecification[] {
  const source = OPENMAPTILES;

  return [
    {
      id: "water",
      type: "fill",
      source,
      "source-layer": "water",
      paint: { "fill-color": mapPalette.water },
    },
    {
      id: "green",
      type: "fill",
      source,
      "source-layer": "landcover",
      filter: ["in", "class", "wood", "grass", "park"],
      paint: { "fill-color": mapPalette.green },
    },
    {
      id: "building",
      type: "fill",
      source,
      "source-layer": "building",
      minzoom: 14,
      paint: { "fill-color": mapPalette.building },
    },
    // Roads are drawn casing-first so the white fill sits inside a hairline,
    // which is what reads as a road on a white ground without adding colour.
    {
      id: "road-casing",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 11,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": mapPalette.roadCasing,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.2, 16, 8],
      },
    },
    {
      id: "road",
      type: "line",
      source,
      "source-layer": "transportation",
      minzoom: 11,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": mapPalette.road,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.4, 16, 6],
      },
    },
    {
      id: "boundary",
      type: "line",
      source,
      "source-layer": "boundary",
      filter: ["<=", "admin_level", 6],
      paint: {
        "line-color": mapPalette.line,
        "line-width": 1,
        "line-dasharray": [3, 2],
      },
    },
    // Sparse by design: town names and nothing else. A basemap crowded with
    // labels competes with the markers that are the entire point.
    {
      id: "place-label",
      type: "symbol",
      source,
      "source-layer": "place",
      filter: ["in", "class", "city", "town", "village"],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11, 14, 15],
        "text-max-width": 8,
      },
      paint: {
        "text-color": mapPalette.lineStrong,
        "text-halo-color": mapPalette.labelHalo,
        "text-halo-width": 1.4,
      },
    },
  ];
}

export function buildMapStyle(basemap: BasemapSource): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    // Needed by any symbol layer. MapTiler serves them; a self-hosted
    // deployment ships the same directory next to the PMTiles file.
    glyphs:
      basemap.kind === "maptiler"
        ? `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${basemap.key}`
        : "/fonts/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": mapPalette.land },
      },
    ],
  };

  if (basemap.kind === "maptiler") {
    style.sources[OPENMAPTILES] = {
      type: "vector",
      url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${basemap.key}`,
    };
    style.layers.push(...basemapLayers());
  }

  if (basemap.kind === "pmtiles") {
    style.sources[OPENMAPTILES] = {
      type: "vector",
      // The `pmtiles://` protocol is registered by the map component; the file
      // is read by range request, so only the tiles on screen are fetched.
      url: `pmtiles://${basemap.url}`,
    };
    style.layers.push(...basemapLayers());
  }

  return style;
}
