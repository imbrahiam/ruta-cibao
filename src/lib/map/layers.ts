import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTERS_SOURCE_LAYER,
  PLACE_LABEL_ZOOM,
  PLACES_SOURCE_ID,
  PLACES_SOURCE_LAYER,
} from "./config";
import { mapPalette } from "./palette";

/**
 * The citizen layer.
 *
 * Pins drawn on demand rather than a sprite sheet: a sheet has to be built,
 * shipped and kept in step with a taxonomy the municipality edits at runtime.
 * Each pin's image id is built from the colour and icon the tile already
 * carries, and `installPinResolver` draws the ones the map has not seen yet —
 * the same shape the Google renderer uses, so the two read as one product.
 *
 * Every place gets the same treatment regardless of category. Ranking them by
 * size or colour weight would be the platform deciding whose report matters
 * more, and that is not its call to make.
 */
export const PLACES_LAYER_ID = "places-marker";
export const PLACES_LABEL_LAYER_ID = "places-label";
export const PLACES_HIT_LAYER_ID = "places-hit";
export const CLUSTERS_LAYER_ID = "clusters-marker";
export const CLUSTERS_COUNT_LAYER_ID = "clusters-count";

/**
 * The clusters shown below `CLUSTER_MAX_ZOOM`.
 *
 * A filled circle with the count inside, sized by how many places it stands
 * for. Colour is the commonest category in the cell — a hint rather than a
 * claim, since the exact mix only matters once you are close enough to see the
 * individual markers anyway.
 */
export function clusterLayers(
  categoryIds: string[] = [],
): LayerSpecification[] {
  const selectedCategories = [...new Set(categoryIds)];
  const count: ExpressionSpecification =
    selectedCategories.length === 0
      ? ["get", "count"]
      : [
          "+",
          0,
          ...selectedCategories.map(
            (id): ExpressionSpecification => [
              "coalesce",
              ["get", `count:${id}`],
              0,
            ],
          ),
        ];
  const filter: ExpressionSpecification = [">", count, 0];
  return [
    {
      id: CLUSTERS_LAYER_ID,
      type: "circle",
      source: PLACES_SOURCE_ID,
      "source-layer": CLUSTERS_SOURCE_LAYER,
      maxzoom: CLUSTER_MAX_ZOOM + 1,
      filter,
      paint: {
        "circle-color": categoryIds.length
          ? mapPalette.ink
          : ["coalesce", ["get", "color"], mapPalette.ink],
        // Square-root scaling, so a cluster of a hundred is not twenty-five
        // times the area of a cluster of four.
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["sqrt", count],
          1,
          14,
          10,
          30,
        ],
        "circle-stroke-color": mapPalette.land,
        "circle-stroke-width": 2,
        "circle-opacity": 0.92,
      },
    },
    {
      id: CLUSTERS_COUNT_LAYER_ID,
      type: "symbol",
      source: PLACES_SOURCE_ID,
      "source-layer": CLUSTERS_SOURCE_LAYER,
      maxzoom: CLUSTER_MAX_ZOOM + 1,
      filter,
      layout: {
        "text-field": ["to-string", count],
        "text-font": ["Noto Sans Regular"],
        "text-size": 13,
        "text-allow-overlap": true,
      },
      paint: { "text-color": mapPalette.land },
    },
  ];
}

export function placesLayers(selectedId: string | null): LayerSpecification[] {
  const isSelected: ExpressionSpecification = [
    "==",
    ["get", "id"],
    selectedId ?? "",
  ];

  return [
    {
      // Invisible and generous. A 6px dot is an unfair target for a thumb on a
      // moving guagua, so taps are caught by a circle far larger than the one
      // that is drawn.
      id: PLACES_HIT_LAYER_ID,
      type: "circle",
      source: PLACES_SOURCE_ID,
      "source-layer": PLACES_SOURCE_LAYER,
      paint: { "circle-radius": 22, "circle-opacity": 0 },
    },
    {
      id: PLACES_LAYER_ID,
      type: "symbol",
      source: PLACES_SOURCE_ID,
      "source-layer": PLACES_SOURCE_LAYER,
      layout: {
        "icon-image": [
          "concat",
          "pin|",
          ["coalesce", ["get", "color"], mapPalette.ink],
          "|",
          ["coalesce", ["get", "icon"], ""],
          "|",
          ["case", isSelected, "1", "0"],
        ],
        "icon-anchor": "bottom",
        // Every pin stays: hiding one because it collides with another would
        // be the map deciding which neighbour's place matters more.
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        // The selected pin is drawn last, on top of its neighbours.
        "symbol-sort-key": ["case", isSelected, 1, 0],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.75, 13, 1],
      },
    },
    {
      id: PLACES_LABEL_LAYER_ID,
      type: "symbol",
      source: PLACES_SOURCE_ID,
      "source-layer": PLACES_SOURCE_LAYER,
      // Names only once the map is close enough that they will not collide into
      // an unreadable pile.
      minzoom: PLACE_LABEL_ZOOM,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-offset": [0, 0.3],
        "text-anchor": "top",
        "text-max-width": 9,
        "text-optional": true,
      },
      paint: {
        // The category's own colour, straight off the tile property the circle
        // above it already uses, so the word belongs to the marker rather than
        // to the basemap — the same rule the Google renderer follows.
        //
        // That renderer darkens a pale category before drawing the text; this
        // one cannot, because the style spec has no colour arithmetic and the
        // property arrives from the tile. The halo carries it instead, which is
        // why it is wider here than the hairline the DOM labels use.
        "text-color": ["coalesce", ["get", "color"], mapPalette.label],
        "text-halo-color": mapPalette.labelHalo,
        "text-halo-width": 1.6,
      },
    },
  ];
}

/** Layers a tap should be tested against. */
export const INTERACTIVE_LAYER_IDS = [PLACES_HIT_LAYER_ID, CLUSTERS_LAYER_ID];

/**
 * Shows only the chosen categories.
 *
 * Filtering happens here rather than in the tile request. A tile per
 * combination of categories would multiply the cache by every subset anyone
 * ever picks, and the property is already in the tile — so this is instant,
 * works offline against cached tiles, and costs the server nothing.
 *
 * An empty selection means everything, not nothing: a filter that hides the
 * whole map the moment you deselect the last chip is a trap.
 */
export function categoryFilter(
  categoryIds: string[],
): ExpressionSpecification | null {
  if (categoryIds.length === 0) return null;
  return ["in", ["get", "category"], ["literal", categoryIds]];
}
