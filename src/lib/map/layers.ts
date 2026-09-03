import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTERS_SOURCE_LAYER,
  PLACES_SOURCE_ID,
  PLACES_SOURCE_LAYER,
} from "./config";
import { mapPalette } from "./palette";

/**
 * The citizen layer.
 *
 * Circles rather than icon sprites: a sprite sheet has to be built, shipped and
 * kept in step with a taxonomy the municipality edits at runtime, whereas a
 * circle takes its colour straight from the tile property the category already
 * carries. The icon appears in the drawer, where there is room for it and where
 * it is read rather than glanced at.
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
export function clusterLayers(): LayerSpecification[] {
  return [
    {
      id: CLUSTERS_LAYER_ID,
      type: "circle",
      source: PLACES_SOURCE_ID,
      "source-layer": CLUSTERS_SOURCE_LAYER,
      maxzoom: CLUSTER_MAX_ZOOM + 1,
      paint: {
        "circle-color": ["coalesce", ["get", "color"], mapPalette.ink],
        // Square-root scaling, so a cluster of a hundred is not twenty-five
        // times the area of a cluster of four.
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["sqrt", ["get", "count"]],
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
      layout: {
        "text-field": ["to-string", ["get", "count"]],
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
      type: "circle",
      source: PLACES_SOURCE_ID,
      "source-layer": PLACES_SOURCE_LAYER,
      paint: {
        "circle-color": ["coalesce", ["get", "color"], mapPalette.ink],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          9,
          ["case", isSelected, 7, 4],
          16,
          ["case", isSelected, 14, 9],
        ],
        // A white ring is what separates a marker from the road beneath it on a
        // map this pale, and it thickens on the selected one instead of
        // recolouring it — colour already means category.
        "circle-stroke-color": mapPalette.land,
        "circle-stroke-width": ["case", isSelected, 3.5, 1.5],
        "circle-opacity": 1,
      },
    },
    {
      id: PLACES_LABEL_LAYER_ID,
      type: "symbol",
      source: PLACES_SOURCE_ID,
      "source-layer": PLACES_SOURCE_LAYER,
      // Names only once the map is close enough that they will not collide into
      // an unreadable pile.
      minzoom: 13,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
        "text-max-width": 9,
        "text-optional": true,
      },
      paint: {
        "text-color": mapPalette.label,
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
