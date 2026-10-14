/**
 * The map's colours, taken from the app's own tokens.
 *
 * MapLibre style JSON has no notion of CSS variables or `oklch`, so these are
 * the sRGB values of the tokens in `globals.css` — converted, not eyeballed, so
 * the map and the interface around it are literally the same greys.
 *
 * Calm, but not colourless: the land, water and mountains are recognisable at
 * a glance, the way people know them from the maps on their phones, while
 * staying light enough that what citizens put on the map — a report, a route,
 * a business — is still the most saturated thing on screen.
 *
 * Plain data, no React and no DOM, so React Native can hand the same style to
 * MapLibre Native unchanged.
 */
export const mapPalette = {
  /** Warm off-white ground; roads stay white on it, outlined, not filled grey. */
  land: "#f6f5f1",
  landAlt: "#eeece6",
  line: "#d9d5cc",
  lineStrong: "#6b6b6b",
  label: "#1f2933",
  ink: "#171717",
  /** Water reads as water — a soft blue, never the saturated cyan of stock styles. */
  water: "#b5d6ee",
  waterLabel: "#4a7ba3",
  road: "#ffffff",
  roadCasing: "#dcd8cf",
  /** National highways (RD-1, RD-18): a pale amber, the colour drivers already read as "main road". */
  highway: "#fbe3a2",
  highwayCasing: "#e5c46b",
  building: "#e7e4dd",
  /** Parks and woodland. The cordillera is most of this province, so it is visibly green. */
  green: "#d9ead2",
  forest: "#cfe4c6",
  farmland: "#edf0e0",
  labelHalo: "#ffffff",
} as const;

export type MapPalette = typeof mapPalette;
