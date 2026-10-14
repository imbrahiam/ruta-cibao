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
  const p = mapPalette;
  return {
    ...namedFlavor("light"),
    background: p.land,
    earth: p.land,
    water: p.water,
    buildings: p.building,
    park_a: p.green,
    park_b: p.green,
    wood_a: p.forest,
    wood_b: p.forest,
    scrub_a: p.green,
    scrub_b: p.green,
    school: p.landAlt,
    hospital: p.landAlt,
    industrial: p.landAlt,
    pedestrian: p.landAlt,
    aerodrome: p.landAlt,
    sand: p.landAlt,
    beach: p.landAlt,
    zoo: p.green,
    military: p.landAlt,
    pier: p.landAlt,
    // Every road is white on a hairline, the class carried by width rather
    // than by colour; only highways keep a tint.
    other: p.road,
    minor_service: p.road,
    minor_a: p.road,
    minor_b: p.road,
    link: p.road,
    major: p.road,
    highway: p.highway,
    minor_service_casing: p.roadCasing,
    minor_casing: p.roadCasing,
    link_casing: p.roadCasing,
    major_casing_early: p.roadCasing,
    major_casing_late: p.roadCasing,
    highway_casing_early: p.highwayCasing,
    highway_casing_late: p.highwayCasing,
    bridges_other: p.road,
    bridges_minor: p.road,
    bridges_link: p.road,
    bridges_major: p.road,
    bridges_highway: p.highway,
    bridges_other_casing: p.roadCasing,
    bridges_minor_casing: p.roadCasing,
    bridges_link_casing: p.roadCasing,
    bridges_major_casing: p.roadCasing,
    bridges_highway_casing: p.highwayCasing,
    railway: p.line,
    boundaries: "#b9b6ae",
    // White halos everywhere: the stock grey halo reads as a smudge on a
    // light ground.
    roads_label_minor: p.roadLabel,
    roads_label_minor_halo: p.labelHalo,
    roads_label_major: p.roadLabel,
    roads_label_major_halo: p.labelHalo,
    address_label: p.roadLabel,
    address_label_halo: p.labelHalo,
    city_label: p.label,
    city_label_halo: p.labelHalo,
    subplace_label: "#70757a",
    subplace_label_halo: p.labelHalo,
    state_label: p.labelMuted,
    state_label_halo: p.labelHalo,
    country_label: p.labelMuted,
    ocean_label: p.waterLabel,
    landcover: {
      glacier: "#ffffff",
      forest: p.forest,
      grassland: p.green,
      scrub: p.green,
      farmland: p.farmland,
      barren: p.landAlt,
      urban_area: p.landAlt,
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
 * Adjustments to individual Protomaps layers that a flavor cannot express.
 *
 * - Rivers: the stock width reaches 12 px at street zoom, which drew the
 *   Yaguajal through Sabaneta as a blue band heavier than the avenue beside
 *   it and easy to mistake for a boundary.
 * - Labels: Medium rather than Regular for towns and neighbourhoods, and a
 *   wider halo, so names hold up on a phone in the sun — the condition Uber
 *   and Google tune for, and the one this province's users are in.
 */
function refineProtomapsLayer(layer: LayerSpecification): LayerSpecification {
  if (layer.id === "water_river" && layer.type === "line") {
    return {
      ...layer,
      paint: {
        ...layer.paint,
        "line-width": [
          "interpolate",
          ["exponential", 1.6],
          ["zoom"],
          9,
          0,
          10,
          0.6,
          14,
          2,
          18,
          6,
        ],
      },
    };
  }
  if (
    (layer.id === "places_locality" || layer.id === "places_subplace") &&
    layer.type === "symbol"
  ) {
    return {
      ...layer,
      layout: { ...layer.layout, "text-font": ["Noto Sans Medium"] },
      paint: { ...layer.paint, "text-halo-width": 1.5 },
    };
  }
  return layer;
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
      // OpenStreetMap is the credit ODbL requires. Protomaps asks for one
      // but does not require it; it is credited in the README instead, so
      // the (i) on the map carries one line.
      attribution:
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
      maxzoom: 15,
    };
    // Spanish labels where the data carries them. Without the basemap's own
    // points of interest: an OSM "Ayuntamiento" icon beside the province's
    // pin for the same building is two answers to one question, and only one
    // of them can be tapped. The Google renderer hides its POIs for the same
    // reason.
    style.layers.push(
      ...layers(SOURCE_ID, protomapsFlavor(), { lang: "es" })
        .filter((layer) => layer.id !== "pois")
        .map(refineProtomapsLayer),
    );
  }

  return style;
}
