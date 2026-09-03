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
  /** --background */
  land: "#ffffff",
  /** --secondary / --muted */
  landAlt: "#f5f5f5",
  /** --border */
  line: "#e5e5e5",
  /** --muted-foreground */
  lineStrong: "#737373",
  /** --foreground */
  label: "#0a0a0a",
  /** --primary */
  ink: "#171717",
  /** A cool neutral rather than a saturated blue, to stay in the same family. */
  water: "#e8ecef",
  waterLabel: "#8a9299",
  /** Roads are white with a hairline casing: visible, never loud. */
  road: "#ffffff",
  roadCasing: "#e5e5e5",
  building: "#f2f2f2",
  green: "#f0f3f0",
  labelHalo: "#ffffff",
} as const;

export type MapPalette = typeof mapPalette;
