/**
 * How the ground is drawn.
 *
 * Three, because this province needs different things from a map at different
 * moments:
 *
 *   `mapa`      the styled street map. What you want when looking for a place
 *               or reading traffic.
 *   `relieve`   terrain with relief shading. The province is hills, and an
 *               ecotourism route means nothing without knowing what it climbs.
 *   `satelite`  imagery with labels. Agricultural land, river courses and the
 *               shape of a town as it actually is, which matters when the
 *               streets are unnamed and the landmark is a plot of tobacco.
 *
 * Plain data with no DOM, so a React Native build reads the same list.
 */
export const VIEW_MODES = ["mapa", "relieve", "satelite"] as const;

export type ViewMode = (typeof VIEW_MODES)[number];

export const DEFAULT_VIEW_MODE: ViewMode = "mapa";

/**
 * The Google map type for each mode.
 *
 * `hybrid` rather than `satellite`: imagery with no labels leaves someone
 * unable to tell one green square from another, and the names are the point.
 */
export function googleMapTypeFor(
  mode: ViewMode,
): "roadmap" | "terrain" | "hybrid" {
  switch (mode) {
    case "relieve":
      return "terrain";
    case "satelite":
      return "hybrid";
    default:
      return "roadmap";
  }
}

/**
 * Whether a custom style applies.
 *
 * Google ignores styling on terrain and imagery — the pixels are photographs,
 * not vectors — so passing one there is silently dropped rather than an error.
 * Saying so here keeps the caller from wondering why it had no effect.
 */
export function acceptsCustomStyle(mode: ViewMode): boolean {
  return mode === "mapa";
}
