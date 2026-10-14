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
  /**
   * A near-neutral ground, a touch warm so it never reads as a blank page.
   * Tonal on purpose — Uber, Google since its 2023 palette, and every
   * map-first product converge on the same rule: the basemap is a quiet
   * monochrome, and what people put on it is the only colour on screen.
   */
  land: "#f4f3f0",
  landAlt: "#eeede9",
  line: "#d9d7d1",
  lineStrong: "#6b6b6b",
  label: "#3c4043",
  /** Towns and villages beyond the province, stepped back a tone. */
  labelMuted: "#9aa0a6",
  ink: "#171717",
  /** Pale, slightly cool water: recognisable at a glance, never loud. */
  water: "#c4dcee",
  waterLabel: "#5b87ad",
  road: "#ffffff",
  roadCasing: "#e1dfda",
  roadLabel: "#80868b",
  /**
   * National highways (RD-1, RD-18) keep a hint of amber — the one colour a
   * driver here already reads as "main road", which a low-literacy reader
   * should not have to learn — but desaturated, so it sits under the pins.
   */
  highway: "#fdebbd",
  highwayCasing: "#ecd394",
  building: "#e8e6e1",
  /**
   * Parks and woodland, barely tinted. The cordillera is most of this
   * province; at full strength it turned the whole south into one green
   * slab that fought every pin over it.
   */
  green: "#e5eedf",
  forest: "#e2ebdb",
  farmland: "#f0f0ea",
  labelHalo: "#ffffff",
  /** The province's outline and names: the app's primary green. */
  province: "#1f4d3f",
  /** Laid over the rest of the country, at low opacity, to dim it. */
  outside: "#8c8a83",
  /** The "you are here" dot — the blue every phone map has taught people. */
  location: "#1a73e8",
} as const;

export type MapPalette = typeof mapPalette;
