/*
 * Design tokens as pure data: no React Native, no platform imports, so Bun
 * can read them. `packages/shared/scripts/native-tokens.ts` turns them into
 * Swift and Kotlin.
 *
 * The single source of truth for the native apps' colours and metrics.
 */

/**
 * Design tokens.
 *
 * Two themes share one set of token names, so every screen re-skins by
 * switching theme and nothing else. A theme is a seed per scheme (paper,
 * greys, ink, accent) plus a basemap palette; `buildPalette` derives the rest.
 * Status colours (traffic severity, success, warning, error, "you are here")
 * and category colours are the same in every theme because they carry meaning.
 *
 * - `suave`: the warm paper and deep pine of the landing page.
 * - `clasico`: black and white, for those who want the map to do the talking.
 *
 * Contrast: text tokens pass WCAG AA (4.5:1) on `background`, `surface` and
 * `inset` in both schemes; `textTertiary` is the lightest text allowed for
 * captions. An accent keeps 4.5:1 against `onAccent` and 3:1 against
 * `background`.
 *
 * Every value a component uses comes from here: a one-off hex is a bug.
 */

export type MapPalette = {
  ground: string;
  natural: string;
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

export type Seed = {
  paper: string;
  elevated: string;
  surface: string;
  inset: string;
  fill: string;
  fillPressed: string;
  ink: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  onAccent: string;
  hairline: string;
  glass: string;
};

export type ThemeDefinition = {
  light: Seed;
  dark: Seed;
  map: { light: MapPalette; dark: MapPalette };
};

export const status = {
  light: {
    onStatus: "#FFFFFF",
    /** For a status colour white cannot carry (amber, yellow). */
    onStatusDark: "#000000",
    success: "#05944F",
    successInk: "#03703C",
    successSoft: "rgba(5, 148, 79, 0.10)",
    warning: "#C77E00",
    warningInk: "#8A5600",
    warningSoft: "rgba(255, 192, 67, 0.20)",
    danger: "#E11900",
    dangerInk: "#B01400",
    dangerSoft: "rgba(225, 25, 0, 0.08)",
    locate: "#276EF1",
    scrim: "rgba(0, 0, 0, 0.32)",
    shadow: "#000000",
  },
  dark: {
    onStatus: "#FFFFFF",
    onStatusDark: "#000000",
    success: "#3CCB7F",
    successInk: "#6EDDA2",
    successSoft: "rgba(60, 203, 127, 0.16)",
    warning: "#FFC043",
    warningInk: "#FFD27A",
    warningSoft: "rgba(255, 192, 67, 0.16)",
    danger: "#FF6B57",
    dangerInk: "#FF9585",
    dangerSoft: "rgba(255, 107, 87, 0.16)",
    locate: "#5B91F5",
    scrim: "rgba(0, 0, 0, 0.55)",
    shadow: "#000000",
  },
} as const;

export const THEMES = {
  /**
   * Soft: the warm paper and deep pine of the original Ruta Cibao landing
   * page. Quiet neutrals, colour only where it marks something.
   */
  suave: {
    light: {
      paper: "#FAFAF7",
      elevated: "#FFFFFF",
      surface: "#FFFFFF",
      inset: "#F2F1EC",
      fill: "#ECEAE3",
      fillPressed: "#E1DED5",
      ink: "#121211",
      textSecondary: "#57554F",
      textTertiary: "#6F6C64",
      textDisabled: "#B5B2A9",
      accent: "#1F6B52",
      accentPressed: "#175A44",
      accentSoft: "rgba(31, 107, 82, 0.10)",
      onAccent: "#FFFFFF",
      hairline: "rgba(18, 18, 17, 0.08)",
      glass: "rgba(255, 255, 255, 0.92)",
    },
    dark: {
      paper: "#121211",
      elevated: "#1C1C1A",
      surface: "#1C1C1A",
      inset: "#1A1A18",
      fill: "#242421",
      fillPressed: "#2E2E2B",
      ink: "#F3F2EE",
      textSecondary: "#B4B1A8",
      textTertiary: "#98958C",
      textDisabled: "#57554F",
      accent: "#5FBF9A",
      accentPressed: "#7DD0B0",
      accentSoft: "rgba(95, 191, 154, 0.14)",
      onAccent: "#121211",
      hairline: "rgba(255, 255, 255, 0.08)",
      glass: "rgba(28, 28, 26, 0.92)",
    },
    map: {
      light: {
        ground: "#F4F3EF",
        natural: "#F4F3EF",
        park: "#E2EADD",
        water: "#CFDDE3",
        waterLabel: "#5E7F8C",
        road: "#FFFFFF",
        roadEdge: "#E4E1D8",
        highway: "#EFE3C8",
        label: "#57554F",
        labelStrong: "#2A2926",
        labelMuted: "#8A877F",
        labelHalo: "#FAFAF7",
        adminLine: "#CFCBC0",
      },
      dark: {
        ground: "#181816",
        natural: "#181816",
        park: "#1C241D",
        water: "#121A1D",
        waterLabel: "#4E636B",
        road: "#2A2A27",
        roadEdge: "#20201E",
        highway: "#3A3527",
        label: "#8E8B82",
        labelStrong: "#D6D3CA",
        labelMuted: "#6E6B63",
        labelHalo: "#181816",
        adminLine: "#36352F",
      },
    },
  },
  /**
   * Monochrome: a white canvas and ink accents, for those who want the map
   * to do the talking. Inset surfaces are a neutral grey (no warm cast), so
   * inputs and grouped rows read against the white and stay black-and-white.
   */
  clasico: {
    light: {
      paper: "#FFFFFF",
      elevated: "#FFFFFF",
      surface: "#FFFFFF",
      inset: "#F3F3F3",
      fill: "#E8E8E8",
      fillPressed: "#DCDCDC",
      ink: "#000000",
      textSecondary: "#545454",
      textTertiary: "#6B6B6B",
      textDisabled: "#AFAFAF",
      accent: "#000000",
      accentPressed: "#333333",
      accentSoft: "rgba(0, 0, 0, 0.06)",
      onAccent: "#FFFFFF",
      hairline: "rgba(0, 0, 0, 0.08)",
      glass: "rgba(255, 255, 255, 0.94)",
    },
    dark: {
      paper: "#000000",
      elevated: "#1C1C1C",
      surface: "#1C1C1C",
      inset: "#141414",
      fill: "#2B2B2B",
      fillPressed: "#363636",
      ink: "#FFFFFF",
      textSecondary: "#BDBDBD",
      textTertiary: "#9A9A9A",
      textDisabled: "#5E5E5E",
      accent: "#FFFFFF",
      accentPressed: "#DDDDDD",
      accentSoft: "rgba(255, 255, 255, 0.10)",
      onAccent: "#000000",
      hairline: "rgba(255, 255, 255, 0.10)",
      glass: "rgba(28, 28, 28, 0.94)",
    },
    map: {
      light: {
        ground: "#F3F3F3",
        natural: "#F3F3F3",
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
        natural: "#1B1B1B",
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
    },
  },
} satisfies Record<string, ThemeDefinition>;

export type ThemeId = keyof typeof THEMES;
export const DEFAULT_THEME: ThemeId = "clasico";

export function buildPalette(seed: Seed, scheme: "light" | "dark") {
  return {
    /** The canvas every screen sits on: a near-white neutral in light mode. */
    background: seed.paper,
    /** Inset grouped screens: rows in white cards on the canvas. */
    grouped: seed.paper,
    groupedRow: scheme === "light" ? seed.surface : seed.elevated,
    /** Things floating over the map or content: sheets, search bar, map buttons. */
    elevated: seed.elevated,
    surface: seed.surface,
    inset: seed.inset,
    fill: seed.fill,
    fillPressed: seed.fillPressed,
    separator: seed.fill,
    hairline: seed.hairline,

    text: seed.ink,
    textSecondary: seed.textSecondary,
    textTertiary: seed.textTertiary,
    textDisabled: seed.textDisabled,

    // Actions (primary buttons, selected chips, links, the tab bar) are ink on
    // paper in every theme: colour on buttons and text reads as noise. The
    // theme's own colour lives on the map, where it marks things.
    accent: seed.ink,
    accentPressed: seed.textSecondary,
    accentSoft: seed.fill,
    onAccent: seed.paper,

    /** The theme's colour: clusters and other app-drawn map marks. */
    pin: seed.accent,
    onPin: seed.onAccent,

    pine: seed.ink,
    onPine: seed.paper,

    glass: seed.glass,
    ...status[scheme],
  };
}

export type Palette = ReturnType<typeof buildPalette>;

/** 4pt grid. Screens use `md` gutters; dense rows use `sm`. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  input: 12,
  card: 16,
  panel: 24,
  frame: 32,
  pill: 999,
} as const;

/** Minimum touch target: 44pt on iOS, 48dp on Android. */
export const TOUCH = { ios: 44, android: 48 } as const;

/**
 * Type scale, mirroring the iOS text styles so the app reads as native and
 * scales with Dynamic Type (React Native multiplies by the user's setting).
 */
export const type = {
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700",
    letterSpacing: 0.37,
  },
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: 0.36,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: 0.35,
  },
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "600",
    letterSpacing: 0.38,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.41,
  },
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400",
    letterSpacing: -0.41,
  },
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "400",
    letterSpacing: -0.32,
  },
  subhead: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400",
    letterSpacing: -0.24,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    letterSpacing: -0.08,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    letterSpacing: 0,
  },
  /** Small uppercase section labels and counts. */
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
} as const;

export type TypeVariant = keyof typeof type;

/** Bezier control points (x1, y1, x2, y2). Never ease-in on UI. */
export const ease = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  sheet: [0.32, 0.72, 0, 1],
} as const;

export const spring = {
  settle: { duration: 400, dampingRatio: 1 },
  snap: { duration: 400, dampingRatio: 0.8 },
  sheet: { duration: 300, dampingRatio: 0.8 },
} as const;
