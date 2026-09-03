/**
 * The map's colours, taken from the app's own tokens.
 *
 * MapLibre style JSON has no notion of CSS variables or `oklch`, so these are
 * the sRGB values of the tokens in `globals.css` — converted, not eyeballed, so
 * the map and the interface around it are literally the same greys.
 *
 * The result is the deliberately quiet basemap that ride-hailing apps
 * popularised: white land, barely-there roads, water as a cool grey, almost no
 * labels. The point is that the map is a backdrop. What the citizens of the
 * province put on it — a report, a route, a business — has to be the only thing
 * with colour, and that only works if everything underneath stays out of the
 * way.
 *
 * Plain data, no React and no DOM, so React Native can hand the same style to
 * MapLibre Native unchanged.
 */
export const mapPalette = {
  /**
   * The ground is a light grey and the roads on it are white — not the other
   * way round.
   *
   * The first attempt used --background for both, which is how the interface
   * treats a surface, and the map came out invisible: white roads on white
   * land, separated by a hairline that is under a pixel wide at province zoom.
   * Ride-hailing maps read the way they do because the ground recedes and the
   * road network is the bright thing drawn on top of it.
   */
  /** --secondary / --muted */
  land: "#f4f4f4",
  landAlt: "#ededed",
  /** --border, for hairlines and boundaries */
  line: "#dcdcdc",
  /** --muted-foreground */
  lineStrong: "#737373",
  /** --foreground */
  label: "#0a0a0a",
  /** --primary */
  ink: "#171717",
  /** A cool neutral rather than a saturated blue, to stay in the same family. */
  water: "#dbe3e8",
  waterLabel: "#8a9299",
  /** --background: the network, bright against the ground. */
  road: "#ffffff",
  roadCasing: "#e2e2e2",
  building: "#e8e8e8",
  green: "#e9eee9",
  labelHalo: "#ffffff",
} as const;

export type MapPalette = typeof mapPalette;
