/**
 * The basemap palettes of the staff desk's map, one per style the desk offers
 * (`MAP_STYLES` in `map-style.ts`), each in a light and a dark scheme.
 *
 * - `gris` is the phone app's palette, copied from `apps/mobile/src/ui/theme.ts`
 *   (`THEMES.clasico.map` and the ink/paper pair `palettes[scheme].pin` is built
 *   from) because the web desk cannot import from the Expo app. Keep both in
 *   step: a re-tint there is a re-tint here.
 * - `colores` uses green vegetation, blue water and warm pastel ground.
 *   Road fills stay pale so reported stretches and place markers stay visible.
 */
export type Scheme = "light" | "dark";

export type MapPalette = {
  ground: string;
  park: string;
  water: string;
  waterLabel: string;
  road: string;
  roadEdge: string;
  highway: string;
  label: string;
  labelStrong: string;
  labelMuted: string;
  labelHalo: string;
  adminLine: string;
};

/** What `colores` adds: tones the gray style paints with `ground` alone. */
export type ColoresPalette = MapPalette & {
  natural: string;
  /** Built-up land, a shade off `ground`. */
  building: string;
  buildingEdge: string;
  highwayEdge: string;
  /** Green and blue names, quieter than the street names. */
  parkLabel: string;
};

const GRIS: Record<Scheme, MapPalette> = {
  light: {
    ground: "#F3F3F3",
    park: "#E6EBE6",
    water: "#D6DDE3",
    waterLabel: "#8A97A1",
    road: "#FFFFFF",
    roadEdge: "#E3E3E3",
    highway: "#DADADA",
    label: "#5E5E5E",
    labelStrong: "#2B2B2B",
    labelMuted: "#8A8A8A",
    labelHalo: "#FFFFFF",
    adminLine: "#C9C9C9",
  },
  dark: {
    ground: "#1B1B1B",
    park: "#1F241F",
    water: "#0E1418",
    waterLabel: "#4E5A62",
    road: "#2E2E2E",
    roadEdge: "#232323",
    highway: "#3D3D3D",
    label: "#8C8C8C",
    labelStrong: "#CFCFCF",
    labelMuted: "#7A7A7A",
    labelHalo: "#1B1B1B",
    adminLine: "#3A3A3A",
  },
};

const COLORES: Record<Scheme, ColoresPalette> = {
  light: {
    ground: "#F5F1DF",
    natural: "#DDECC2",
    building: "#EDE7D7",
    buildingEdge: "#DCD5C4",
    park: "#C5E3AB",
    water: "#AED8EF",
    waterLabel: "#245578",
    parkLabel: "#355C2D",
    road: "#FFFFFF",
    roadEdge: "#DCD5C4",
    highway: "#F8DF9E",
    highwayEdge: "#DCD5C4",
    label: "#555A55",
    labelStrong: "#262925",
    labelMuted: "#6B6F69",
    labelHalo: "#FFFFFF",
    adminLine: "#C4BFB3",
  },
  dark: {
    ground: "#222B27",
    natural: "#293D2D",
    building: "#2A332D",
    buildingEdge: "#354039",
    park: "#274B34",
    water: "#16374C",
    waterLabel: "#A7D5ED",
    parkLabel: "#B3D79E",
    road: "#404844",
    roadEdge: "#354039",
    highway: "#635135",
    highwayEdge: "#354039",
    label: "#AEB2B8",
    labelStrong: "#E8EAEC",
    labelMuted: "#989DA3",
    labelHalo: "#1E2124",
    adminLine: "#454A50",
  },
};

export const MAP_PALETTES = { colores: COLORES, gris: GRIS } as const;

/**
 * The brand's pine on the map: routes, route ends and the faint context dots.
 * Deep pine holds about 7:1 against the grey ground and white roads in light,
 * the pale pine about 9:1 on the dark ground, and each rim is the paper
 * colour. Severity colours do not clear 3:1 on every
 * ground, so the stretch line is adjusted per style (`stretchColor`).
 */
export const MAP_INK: Record<
  Scheme,
  { pin: string; onPin: string; background: string; onStatus: string }
> = {
  light: {
    pin: "#28594A",
    onPin: "#FFFFFF",
    background: "#F6F6F6",
    onStatus: "#FFFFFF",
  },
  dark: {
    pin: "#8FCAB2",
    onPin: "#0F1F19",
    background: "#000000",
    onStatus: "#FFFFFF",
  },
};
