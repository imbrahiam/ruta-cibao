import type {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { MAP_FONTS, MAP_PALETTES, type MapTheme } from "./palette";

/**
 * The basemap style, written by hand for the Protomaps schema.
 *
 * Nothing here comes from a prebuilt style. The order is the order a person
 * reads a map in: ground, water, roads, buildings, then names. Roads are told
 * apart by width and the strength of their casing rather than by colour, which
 * keeps red, amber and green free for traffic.
 *
 * Points of interest from OpenStreetMap are left out entirely. The places on
 * this map are the ones citizens and the municipality curate, drawn by the app
 * as its own pins; a second, unmoderated set underneath would compete with
 * them and contradict them.
 */
export const BASEMAP_SOURCE = "basemap";

const NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name:es"],
  ["get", "name"],
];

/** Width that doubles roughly every zoom level, the way a road on the ground does. */
function width(stops: [number, number][]): ExpressionSpecification {
  return [
    "interpolate",
    ["exponential", 1.6],
    ["zoom"],
    ...stops.flat(),
  ] as ExpressionSpecification;
}

function kindIn(...kinds: string[]): ExpressionSpecification {
  return ["in", ["get", "kind"], ["literal", kinds]];
}

function detailIn(...details: string[]): ExpressionSpecification {
  return ["in", ["get", "kind_detail"], ["literal", details]];
}

export function basemapStyle({
  theme,
  pmtilesUrl,
  attribution,
}: {
  theme: MapTheme;
  pmtilesUrl: string;
  attribution: string;
}): StyleSpecification {
  const p = MAP_PALETTES[theme];
  const glyphsOrigin =
    typeof window === "undefined" ? "" : window.location.origin;

  const layers: LayerSpecification[] = [
    {
      id: "background",
      type: "background",
      paint: { "background-color": p.land },
    },
    {
      id: "earth",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "earth",
      paint: { "fill-color": p.land },
    },
    {
      id: "landcover",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "kind"],
          "forest",
          p.forest,
          "grassland",
          p.park,
          "farmland",
          p.farmland,
          "scrub",
          p.forest,
          "barren",
          p.sand,
          p.land,
        ],
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 10, 0.4],
      },
    },
    {
      id: "landuse-nature",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "landuse",
      filter: kindIn(
        "wood",
        "forest",
        "nature_reserve",
        "national_park",
        "protected_area",
        "scrub",
        "grassland",
        "meadow",
      ),
      paint: { "fill-color": p.forest },
    },
    {
      id: "landuse-farmland",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "landuse",
      filter: kindIn("farmland", "orchard", "farmyard", "allotments"),
      paint: { "fill-color": p.farmland },
    },
    {
      id: "landuse-residential",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "landuse",
      filter: kindIn(
        "residential",
        "neighbourhood",
        "commercial",
        "retail",
        "industrial",
      ),
      paint: {
        "fill-color": p.residential,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0, 12, 1],
      },
    },
    {
      id: "landuse-park",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "landuse",
      filter: kindIn(
        "park",
        "playground",
        "pitch",
        "garden",
        "golf_course",
        "cemetery",
        "grass",
        "village_green",
        "recreation_ground",
      ),
      paint: { "fill-color": p.park },
    },
    {
      id: "landuse-civic",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "landuse",
      filter: kindIn(
        "school",
        "university",
        "college",
        "hospital",
        "aerodrome",
        "military",
        "railway",
      ),
      paint: { "fill-color": p.civic },
    },
    {
      id: "landuse-wetland",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "landuse",
      filter: kindIn("wetland", "marsh", "swamp", "bog"),
      paint: { "fill-color": p.wetland },
    },
    {
      id: "landuse-sand",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "landuse",
      filter: kindIn("beach", "sand", "bare_rock", "quarry"),
      paint: { "fill-color": p.sand },
    },
    {
      id: "water",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "water",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": p.water },
    },
    {
      id: "water-river",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "water",
      filter: [
        "all",
        ["==", ["geometry-type"], "LineString"],
        kindIn("river", "canal"),
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.water,
        "line-width": width([
          [9, 0.6],
          [13, 2.2],
          [16, 6],
        ]),
      },
    },
    {
      id: "water-stream",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "water",
      minzoom: 12,
      filter: [
        "all",
        ["==", ["geometry-type"], "LineString"],
        kindIn("stream", "ditch", "drain"),
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.waterLine,
        "line-width": width([
          [12, 0.5],
          [16, 2],
        ]),
      },
    },

    // Roads: casings first, then fills, so crossings read as one network.
    {
      id: "road-path",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "roads",
      minzoom: 13,
      filter: kindIn("path"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.path,
        "line-width": width([
          [13, 0.6],
          [17, 1.6],
        ]),
        "line-dasharray": [2, 1.6],
      },
    },
    {
      id: "road-rail",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "roads",
      minzoom: 12,
      filter: kindIn("rail"),
      paint: {
        "line-color": p.rail,
        "line-width": width([
          [12, 0.6],
          [17, 1.6],
        ]),
      },
    },
    {
      id: "road-minor-casing",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "roads",
      minzoom: 12,
      filter: kindIn("minor_road"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.casingMinor,
        "line-width": width([
          [12, 1],
          [14, 3],
          [17, 13],
          [19, 30],
        ]),
      },
    },
    {
      id: "road-major-casing",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "roads",
      minzoom: 7,
      filter: kindIn("major_road"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.casingMajor,
        "line-width": width([
          [7, 0.8],
          [10, 1.8],
          [13, 4.2],
          [16, 12],
          [19, 36],
        ]),
      },
    },
    {
      id: "road-highway-casing",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "roads",
      minzoom: 5,
      filter: kindIn("highway"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.casingHighway,
        "line-width": width([
          [5, 0.8],
          [9, 2.4],
          [13, 6],
          [16, 15],
          [19, 42],
        ]),
      },
    },
    {
      id: "road-minor",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "roads",
      minzoom: 13,
      filter: kindIn("minor_road"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.roadMinor,
        "line-width": width([
          [13, 1],
          [14, 1.8],
          [17, 10.5],
          [19, 26],
        ]),
      },
    },
    {
      id: "road-major",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "roads",
      minzoom: 9,
      filter: kindIn("major_road"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.roadMajor,
        "line-width": width([
          [9, 0.6],
          [13, 2.8],
          [16, 9.5],
          [19, 31],
        ]),
      },
    },
    {
      id: "road-highway",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "roads",
      minzoom: 7,
      filter: kindIn("highway"),
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.roadHighway,
        "line-width": width([
          [7, 0.6],
          [9, 1.4],
          [13, 4.2],
          [16, 12],
          [19, 37],
        ]),
      },
    },

    {
      id: "buildings",
      type: "fill",
      source: BASEMAP_SOURCE,
      "source-layer": "buildings",
      minzoom: 14,
      paint: {
        "fill-color": p.building,
        "fill-outline-color": p.buildingLine,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
      },
    },

    {
      id: "border-country",
      type: "line",
      source: BASEMAP_SOURCE,
      "source-layer": "boundaries",
      filter: kindIn("country"),
      paint: {
        "line-color": p.border,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 12, 1.6],
        "line-dasharray": [3, 2],
      },
    },

    // Names, from water up to towns, so the most important label wins a tie.
    {
      id: "label-water",
      type: "symbol",
      source: BASEMAP_SOURCE,
      "source-layer": "water",
      minzoom: 12,
      filter: ["all", ["==", ["geometry-type"], "LineString"], ["has", "name"]],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": [...MAP_FONTS.regular],
        "text-size": 11,
        "text-letter-spacing": 0.04,
        "symbol-spacing": 320,
      },
      paint: {
        "text-color": p.waterLabel,
        "text-halo-color": p.water,
        "text-halo-width": 1,
      },
    },
    {
      id: "label-road",
      type: "symbol",
      source: BASEMAP_SOURCE,
      "source-layer": "roads",
      minzoom: 14,
      filter: [
        "all",
        kindIn("major_road", "minor_road", "highway"),
        ["has", "name"],
      ],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": [...MAP_FONTS.regular],
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10.5, 18, 12.5],
        "symbol-spacing": 280,
        "text-max-angle": 30,
      },
      paint: {
        "text-color": p.label3,
        "text-halo-color": p.roadMinor,
        "text-halo-width": 1.4,
      },
    },
    {
      id: "label-hamlet",
      type: "symbol",
      source: BASEMAP_SOURCE,
      "source-layer": "places",
      minzoom: 12,
      filter: [
        "all",
        kindIn("locality", "neighbourhood"),
        detailIn("hamlet", "neighbourhood", "isolated_dwelling", "locality"),
      ],
      layout: {
        "text-field": NAME,
        "text-font": [...MAP_FONTS.medium],
        "text-size": 11,
        "text-max-width": 8,
        "text-padding": 6,
      },
      paint: {
        "text-color": p.label3,
        "text-halo-color": p.halo,
        "text-halo-width": 1.4,
      },
    },
    {
      id: "label-village",
      type: "symbol",
      source: BASEMAP_SOURCE,
      "source-layer": "places",
      minzoom: 10,
      filter: [
        "all",
        kindIn("locality"),
        detailIn("village", "suburb", "quarter"),
      ],
      layout: {
        "text-field": NAME,
        "text-font": [...MAP_FONTS.medium],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 14, 13],
        "text-max-width": 8,
        "text-padding": 4,
      },
      paint: {
        "text-color": p.label2,
        "text-halo-color": p.halo,
        "text-halo-width": 1.4,
      },
    },
    {
      id: "label-city-world",
      type: "symbol",
      source: BASEMAP_SOURCE,
      "source-layer": "places",
      minzoom: 3,
      maxzoom: 7,
      filter: ["all", kindIn("locality"), detailIn("city")],
      layout: {
        "text-field": NAME,
        "text-font": [...MAP_FONTS.medium],
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 7, 12],
        "text-max-width": 8,
        "text-padding": 8,
        "symbol-sort-key": ["get", "population_rank"],
      },
      paint: {
        "text-color": p.label2,
        "text-halo-color": p.halo,
        "text-halo-width": 1.4,
      },
    },
    {
      id: "label-town",
      type: "symbol",
      source: BASEMAP_SOURCE,
      "source-layer": "places",
      minzoom: 7,
      filter: ["all", kindIn("locality"), detailIn("town", "city")],
      layout: {
        "text-field": NAME,
        "text-font": [...MAP_FONTS.semibold],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          11,
          11,
          13.5,
          15,
          16,
        ],
        "text-max-width": 8,
        "text-letter-spacing": -0.01,
        "symbol-sort-key": ["get", "population_rank"],
      },
      paint: {
        "text-color": p.label,
        "text-halo-color": p.halo,
        "text-halo-width": 1.6,
      },
    },
    {
      id: "label-country",
      type: "symbol",
      source: BASEMAP_SOURCE,
      "source-layer": "places",
      maxzoom: 9,
      filter: kindIn("country"),
      layout: {
        "text-field": ["upcase", NAME],
        "text-font": [...MAP_FONTS.mono],
        "text-size": 11,
        "text-letter-spacing": 0.18,
      },
      paint: {
        "text-color": p.label3,
        "text-halo-color": p.halo,
        "text-halo-width": 1.2,
      },
    },
  ];

  return {
    version: 8,
    name: `ruta-cibao-${theme}`,
    glyphs: `${glyphsOrigin}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      [BASEMAP_SOURCE]: {
        type: "vector",
        url: `pmtiles://${pmtilesUrl.startsWith("http") ? pmtilesUrl : `${glyphsOrigin}${pmtilesUrl}`}`,
        attribution,
      },
    },
    layers,
  };
}
