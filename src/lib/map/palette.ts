/**
 * The map's colours, in the Genesis palette.
 *
 * MapLibre style JSON cannot read CSS variables, so these are written out as
 * hex. Neutrals are the Genesis paper and ink steps; the few hues the ground
 * needs (vegetation, water) are those neutrals tinted toward the "pino"
 * accent, so the map reads as the same material as the interface around it.
 *
 * The ground stays monochrome on purpose. What people put on the map (a place,
 * a closed road, a route) must be the most saturated thing on screen.
 *
 * Plain data with no DOM, so a native client can hand the same values to
 * MapLibre Native.
 */
export type MapTheme = "light" | "dark";

export type MapPalette = {
  land: string;
  forest: string;
  park: string;
  farmland: string;
  residential: string;
  civic: string;
  wetland: string;
  sand: string;
  water: string;
  waterLine: string;
  waterLabel: string;
  building: string;
  buildingLine: string;
  roadMinor: string;
  roadMajor: string;
  roadHighway: string;
  casingMinor: string;
  casingMajor: string;
  casingHighway: string;
  path: string;
  rail: string;
  border: string;
  label: string;
  label2: string;
  label3: string;
  halo: string;
  /** The province veil and outline, laid over the basemap by the app. */
  veil: string;
  veilOpacity: number;
  outline: string;
  municipalLine: string;
  /** Traffic and selection lines sit on a casing the colour of the card. */
  card: string;
  ink: string;
  accent: string;
  locate: string;
};

export const MAP_PALETTES: Record<MapTheme, MapPalette> = {
  light: {
    land: "#f2f1ec",
    forest: "#e6e9de",
    park: "#e1e7d5",
    farmland: "#eeede4",
    residential: "#edebe5",
    civic: "#ebe7e1",
    wetland: "#e2e8e1",
    sand: "#f1ede2",
    water: "#c9d7d4",
    waterLine: "#b5c8c3",
    waterLabel: "#5c7772",
    building: "#e4e1d9",
    buildingLine: "#d6d2c8",
    roadMinor: "#ffffff",
    roadMajor: "#ffffff",
    roadHighway: "#ffffff",
    casingMinor: "#e0ddd5",
    casingMajor: "#d3cfc5",
    casingHighway: "#c3beb2",
    path: "#cbc6bb",
    rail: "#cfcbc2",
    border: "#b5b2a9",
    label: "#121211",
    label2: "#57554f",
    label3: "#8a877f",
    halo: "#fafaf7",
    veil: "#fafaf7",
    veilOpacity: 0.62,
    outline: "#121211",
    municipalLine: "#8a877f",
    card: "#ffffff",
    ink: "#121211",
    accent: "#1f6b52",
    locate: "#2f5bff",
  },
  dark: {
    land: "#171716",
    forest: "#1a1c18",
    park: "#1b1e18",
    farmland: "#191917",
    residential: "#1c1c1a",
    civic: "#1e1d1b",
    wetland: "#171c1a",
    sand: "#1e1d19",
    water: "#0e1918",
    waterLine: "#1a2f2c",
    waterLabel: "#628a83",
    building: "#232320",
    buildingLine: "#2c2c29",
    roadMinor: "#2b2b28",
    roadMajor: "#36352f",
    roadHighway: "#45433d",
    casingMinor: "#1d1d1b",
    casingMajor: "#1b1b19",
    casingHighway: "#191917",
    path: "#3a3935",
    rail: "#33322e",
    border: "#57554f",
    label: "#f3f2ee",
    label2: "#b4b1a8",
    label3: "#85827a",
    halo: "#121211",
    veil: "#121211",
    veilOpacity: 0.58,
    outline: "#f3f2ee",
    municipalLine: "#85827a",
    card: "#1c1c1a",
    ink: "#f3f2ee",
    accent: "#5fbf9a",
    locate: "#5c7dff",
  },
};

/** Font stacks built by `bun run basemap:glyphs`, named as MapLibre asks for them. */
export const MAP_FONTS = {
  regular: ["Inter Regular"],
  medium: ["Inter Medium"],
  semibold: ["Inter SemiBold"],
  mono: ["Geist Mono Medium"],
} as const;
