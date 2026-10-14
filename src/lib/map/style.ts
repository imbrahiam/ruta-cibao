import { type Flavor, layers, namedFlavor } from "@protomaps/basemaps";
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
 * blank ground. So the adapter carries a layer set per schema, and the
 * Protomaps side uses that project's own generator rather than a hand-written
 * approximation of it.
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

/**
 * Our colours, on the official Protomaps layer set.
 *
 * `layers()` from `@protomaps/basemaps` is the maintained style for the v4
 * schema — 71 layers covering road classes, tunnels, bridges, shields and
 * label hierarchies. The eight layers hand-written here before were guesses at
 * that schema, and guessing wrong renders nothing at all.
 *
 * Only the colours are ours. Starting from the official `light` flavor and
 * overriding a handful of entries keeps every layer correct while bringing the
 * map into the app's greys — most of what changes is the water, which ships as
 * a saturated cyan that would be the loudest thing on an otherwise neutral
 * screen.
 */
function protomapsFlavor(): Flavor {
  return {
    ...namedFlavor("light"),
    background: mapPalette.land,
    earth: mapPalette.land,
    water: mapPalette.water,
    buildings: mapPalette.building,
    park_a: mapPalette.green,
    park_b: mapPalette.green,
    wood_a: mapPalette.green,
    wood_b: mapPalette.green,
    scrub_a: mapPalette.green,
    scrub_b: mapPalette.green,
    school: mapPalette.landAlt,
    hospital: mapPalette.landAlt,
    industrial: mapPalette.landAlt,
    pedestrian: mapPalette.landAlt,
    highway: mapPalette.highway,
    highway_casing_early: mapPalette.highwayCasing,
    highway_casing_late: mapPalette.highwayCasing,
    bridges_highway: mapPalette.highway,
    bridges_highway_casing: mapPalette.highwayCasing,
    major: mapPalette.road,
    major_casing_early: mapPalette.roadCasing,
    major_casing_late: mapPalette.roadCasing,
    minor_casing: mapPalette.roadCasing,
    city_label: mapPalette.label,
    subplace_label: "#5b6470",
    ocean_label: mapPalette.waterLabel,
    landcover: {
      glacier: "#ffffff",
      forest: mapPalette.forest,
      grassland: mapPalette.green,
      scrub: mapPalette.green,
      farmland: mapPalette.farmland,
      barren: mapPalette.landAlt,
      urban_area: mapPalette.landAlt,
    },
  };
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
      minzoom: 8,
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
      minzoom: 8,
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

/**
 * @param origin Absolute origin for assets served by this app. MapLibre accepts
 *   a relative URL for glyphs and tiles but rejects one for the sprite —
 *   "Invalid sprite URL, must be absolute" — so it has to be built from
 *   somewhere. Taking it as an argument keeps this module free of `window`,
 *   which is what lets React Native and the tests use it unchanged.
 */
export function buildMapStyle(
  basemap: BasemapSource,
  origin: string,
): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    // Needed by any symbol layer. MapTiler serves them; a self-hosted
    // deployment ships them itself — `bun run basemap:fonts` puts them in
    // public/fonts, and without them every label silently disappears.
    glyphs:
      basemap.kind === "maptiler"
        ? `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${basemap.key}`
        : "/fonts/{fontstack}/{range}.pbf",
    // Route shields, one-way arrows and POI icons are sprite images, and the
    // layers using them render nothing without one. `bun run basemap:fonts`
    // puts it in public/sprites.
    ...(basemap.kind === "maptiler"
      ? {}
      : { sprite: `${origin.replace(/\/$/, "")}/sprites/light` }),
    sources: {},
    // The Protomaps generator brings its own background layer, coloured by the
    // flavor. Adding one here as well is a duplicate id, which MapLibre rejects
    // — so it is only added for the sources that do not supply one.
    layers:
      basemap.kind === "pmtiles"
        ? []
        : [
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
    // Spanish labels where the data carries them.
    style.layers.push(...layers(SOURCE_ID, protomapsFlavor(), { lang: "es" }));
  }

  return style;
}
