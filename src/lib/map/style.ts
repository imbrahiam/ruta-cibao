import type {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { mapPalette } from "./palette";

/**
 * Builds the map style.
 *
 * Three basemap sources, chosen by configuration rather than by code changes:
 *
 *   `pmtiles`   a single self-hosted file covering the province. The handover
 *               path — no key, no bill, no third party, and it works offline.
 *   `maptiler`  hosted vector tiles. Convenient while building.
 *   `none`      no basemap at all. Not a failure mode: the citizen layer still
 *               renders on a clean ground, which is what a development machine
 *               with no keys and no signal gets.
 *
 * **The two hosted schemas are not the same.** Protomaps v4 names its layers
 * `earth`, `roads`, `landuse`, `places`; OpenMapTiles, which MapTiler serves,
 * names them `transportation`, `landcover`, `building`, `place`. A style
 * written for one renders nothing at all against the other — no error, just a
 * blank ground. So the adapter carries a layer set per schema.
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

const SOURCE_ID = "basemap";

/** Roads are drawn casing-first, so white fill sits inside a hairline. */
function roadWidth(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    10,
    0.4 * scale,
    14,
    2.4 * scale,
    18,
    10 * scale,
  ];
}

/** Protomaps v4, the schema the self-hosted extract uses. */
function protomapsLayers(): LayerSpecification[] {
  return [
    {
      id: "earth",
      type: "fill",
      source: SOURCE_ID,
      "source-layer": "earth",
      paint: { "fill-color": mapPalette.land },
    },
    {
      id: "landuse",
      type: "fill",
      source: SOURCE_ID,
      "source-layer": "landuse",
      filter: [
        "in",
        ["get", "kind"],
        [
          "literal",
          ["park", "forest", "wood", "grass", "pitch", "cemetery", "scrub"],
        ],
      ],
      paint: { "fill-color": mapPalette.green },
    },
    {
      id: "water",
      type: "fill",
      source: SOURCE_ID,
      "source-layer": "water",
      paint: { "fill-color": mapPalette.water },
    },
    {
      id: "buildings",
      type: "fill",
      source: SOURCE_ID,
      "source-layer": "buildings",
      minzoom: 14,
      paint: { "fill-color": mapPalette.building },
    },
    {
      id: "roads-casing",
      type: "line",
      source: SOURCE_ID,
      "source-layer": "roads",
      minzoom: 10,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": mapPalette.roadCasing,
        "line-width": roadWidth(2.2),
      },
    },
    {
      id: "roads",
      type: "line",
      source: SOURCE_ID,
      "source-layer": "roads",
      minzoom: 10,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": mapPalette.road,
        // Trunk roads a little wider than the streets off them, so the shape of
        // the town is readable at a glance without adding any colour.
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          ["match", ["get", "kind"], ["highway", "major_road"], 1.1, 0.3],
          18,
          ["match", ["get", "kind"], ["highway", "major_road"], 12, 7],
        ],
      },
    },
    {
      id: "boundaries",
      type: "line",
      source: SOURCE_ID,
      "source-layer": "boundaries",
      paint: {
        "line-color": mapPalette.line,
        "line-width": 1,
        "line-dasharray": [3, 2],
      },
    },
    {
      // Sparse by design. A basemap crowded with labels competes with the
      // markers that are the entire point of this screen.
      id: "places-label",
      type: "symbol",
      source: SOURCE_ID,
      "source-layer": "places",
      filter: [
        "in",
        ["get", "kind"],
        ["literal", ["locality", "city", "town", "village"]],
      ],
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

/** OpenMapTiles, the schema MapTiler serves. */
function openMapTilesLayers(): LayerSpecification[] {
  return [
    {
      id: "water",
      type: "fill",
      source: SOURCE_ID,
      "source-layer": "water",
      paint: { "fill-color": mapPalette.water },
    },
    {
      id: "landcover",
      type: "fill",
      source: SOURCE_ID,
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "park"]]],
      paint: { "fill-color": mapPalette.green },
    },
    {
      id: "building",
      type: "fill",
      source: SOURCE_ID,
      "source-layer": "building",
      minzoom: 14,
      paint: { "fill-color": mapPalette.building },
    },
    {
      id: "transportation-casing",
      type: "line",
      source: SOURCE_ID,
      "source-layer": "transportation",
      minzoom: 10,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": mapPalette.roadCasing,
        "line-width": roadWidth(2.2),
      },
    },
    {
      id: "transportation",
      type: "line",
      source: SOURCE_ID,
      "source-layer": "transportation",
      minzoom: 10,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": mapPalette.road, "line-width": roadWidth(1) },
    },
    {
      id: "boundary",
      type: "line",
      source: SOURCE_ID,
      "source-layer": "boundary",
      filter: ["<=", ["get", "admin_level"], 6],
      paint: {
        "line-color": mapPalette.line,
        "line-width": 1,
        "line-dasharray": [3, 2],
      },
    },
    {
      id: "place-label",
      type: "symbol",
      source: SOURCE_ID,
      "source-layer": "place",
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["city", "town", "village"]],
      ],
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
    // deployment ships them itself — `bun run basemap:fonts` puts them in
    // public/fonts, and without them every label silently disappears.
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
    style.sources[SOURCE_ID] = {
      type: "vector",
      url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${basemap.key}`,
      attribution:
        '<a href="https://www.maptiler.com/copyright/">MapTiler</a> © OpenStreetMap',
    };
    style.layers.push(...openMapTilesLayers());
  }

  if (basemap.kind === "pmtiles") {
    style.sources[SOURCE_ID] = {
      type: "vector",
      // The `pmtiles://` protocol is registered by the map component; the file
      // is read by range request, so only the tiles on screen are fetched.
      url: `pmtiles://${basemap.url}`,
      attribution:
        '<a href="https://protomaps.com">Protomaps</a> © OpenStreetMap',
      maxzoom: 15,
    };
    style.layers.push(...protomapsLayers());
  }

  return style;
}
