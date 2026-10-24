import { useSyncExternalStore } from "react";
import { Platform, useColorScheme } from "react-native";
import { cubicBezier, Easing } from "react-native-reanimated";

/**
 * Design tokens.
 *
 * Three themes share one set of token names, so every screen re-skins by
 * switching theme and nothing else. A theme is a seed per scheme (paper,
 * greys, ink, accent) plus a basemap palette; `buildPalette` derives the rest.
 * Status colours (traffic severity, success, warning, error, "you are here")
 * and category colours are the same in every theme because they carry meaning.
 *
 * - `monte`: greens of the Sierra and the tobacco fields. The default.
 * - `pueblo`: the cobalt and sky of the painted houses on the plaza.
 * - `clasico`: black and white, for those who want the map to do the talking.
 *
 * Contrast: text tokens pass WCAG AA (4.5:1) on `background`, `surface` and
 * `inset` in both schemes; `textTertiary` is the lightest text allowed for
 * captions. An accent keeps 4.5:1 against `onAccent` and 3:1 against
 * `background`.
 *
 * Every value a component uses comes from here: a one-off hex is a bug.
 */
type Seed = {
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

type MapPalette = {
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
  /** Dims the country around the province. */
  veil: string;
};

type ThemeDefinition = {
  light: Seed;
  dark: Seed;
  map: { light: MapPalette; dark: MapPalette };
};

const status = {
  light: {
    onStatus: "#FFFFFF",
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
  civico: {
    light: {
      paper: "#F7F8FA",
      elevated: "#FFFFFF",
      surface: "#FFFFFF",
      inset: "#EFF2F6",
      fill: "#E9EFF6",
      fillPressed: "#DBE3EE",
      ink: "#0C183A",
      textSecondary: "#46506A",
      textTertiary: "#5D6680",
      textDisabled: "#A8AFC0",
      accent: "#007D68",
      accentPressed: "#00624F",
      accentSoft: "rgba(0, 125, 104, 0.10)",
      onAccent: "#FFFFFF",
      hairline: "rgba(12, 24, 58, 0.08)",
      glass: "rgba(255, 255, 255, 0.94)",
    },
    dark: {
      paper: "#0A0F1C",
      elevated: "#151B2B",
      surface: "#151B2B",
      inset: "#0F1524",
      fill: "#222A3D",
      fillPressed: "#2C354A",
      ink: "#EEF1F7",
      textSecondary: "#B4BCCD",
      textTertiary: "#8D96AA",
      textDisabled: "#535C70",
      accent: "#33C6A6",
      accentPressed: "#25A98C",
      accentSoft: "rgba(51, 198, 166, 0.16)",
      onAccent: "#03261E",
      hairline: "rgba(238, 241, 247, 0.10)",
      glass: "rgba(21, 27, 43, 0.94)",
    },
    map: {
      light: {
        ground: "#F2F4F6",
        park: "#DCEDE2",
        water: "#C3DCEF",
        waterLabel: "#4F7EA6",
        road: "#FFFFFF",
        roadEdge: "#DDE2E9",
        highway: "#F5DDA8",
        label: "#4A5368",
        labelStrong: "#1B2440",
        labelMuted: "#7C8498",
        labelHalo: "#FFFFFF",
        adminLine: "#BCC4D2",
        veil: "rgba(255, 255, 255, 0.55)",
      },
      dark: {
        ground: "#121827",
        park: "#15281F",
        water: "#0B1A2C",
        waterLabel: "#4B6A8C",
        road: "#242D42",
        roadEdge: "#1A2133",
        highway: "#4A3F2A",
        label: "#8E97AE",
        labelStrong: "#D5DBEA",
        labelMuted: "#6D768C",
        labelHalo: "#121827",
        adminLine: "#2E3850",
        veil: "rgba(0, 0, 0, 0.45)",
      },
    },
  },
  monte: {
    light: {
      paper: "#F5F8F6",
      elevated: "#FFFFFF",
      surface: "#FFFFFF",
      inset: "#EDF2EF",
      fill: "#E3EBE6",
      fillPressed: "#D4DFD9",
      ink: "#0D1A14",
      textSecondary: "#46574E",
      textTertiary: "#5C6D64",
      textDisabled: "#A9B7AF",
      accent: "#0A7A54",
      accentPressed: "#075F41",
      accentSoft: "rgba(10, 122, 84, 0.10)",
      onAccent: "#FFFFFF",
      hairline: "rgba(13, 26, 20, 0.08)",
      glass: "rgba(255, 255, 255, 0.94)",
    },
    dark: {
      paper: "#0A120E",
      elevated: "#14201A",
      surface: "#14201A",
      inset: "#0E1813",
      fill: "#213029",
      fillPressed: "#2B3C34",
      ink: "#EDF5F0",
      textSecondary: "#B2C3B9",
      textTertiary: "#8EA297",
      textDisabled: "#55665D",
      accent: "#3DD39A",
      accentPressed: "#2FB683",
      accentSoft: "rgba(61, 211, 154, 0.16)",
      onAccent: "#03261A",
      hairline: "rgba(237, 245, 240, 0.10)",
      glass: "rgba(20, 32, 26, 0.94)",
    },
    map: {
      light: {
        ground: "#EEF3EF",
        park: "#D6EAD9",
        water: "#C7E0EE",
        waterLabel: "#5E8AA3",
        road: "#FFFFFF",
        roadEdge: "#D9E3DC",
        highway: "#F6DFA6",
        label: "#4E5F56",
        labelStrong: "#1F2E27",
        labelMuted: "#7E8F86",
        labelHalo: "#FFFFFF",
        adminLine: "#B9C9BF",
        veil: "rgba(255, 255, 255, 0.55)",
      },
      dark: {
        ground: "#141D18",
        park: "#18291F",
        water: "#0D1B24",
        waterLabel: "#4B6B7D",
        road: "#26332C",
        roadEdge: "#1B2721",
        highway: "#4A4128",
        label: "#8DA096",
        labelStrong: "#D3E2D9",
        labelMuted: "#6F8279",
        labelHalo: "#141D18",
        adminLine: "#33463C",
        veil: "rgba(0, 0, 0, 0.45)",
      },
    },
  },
  pueblo: {
    light: {
      paper: "#F6F8FB",
      elevated: "#FFFFFF",
      surface: "#FFFFFF",
      inset: "#EEF2F8",
      fill: "#E4EAF5",
      fillPressed: "#D5DDEE",
      ink: "#0D1430",
      textSecondary: "#454E6B",
      textTertiary: "#5B6483",
      textDisabled: "#A9B0C6",
      accent: "#2B59E0",
      accentPressed: "#2046BA",
      accentSoft: "rgba(43, 89, 224, 0.10)",
      onAccent: "#FFFFFF",
      hairline: "rgba(13, 20, 48, 0.08)",
      glass: "rgba(255, 255, 255, 0.94)",
    },
    dark: {
      paper: "#090E1E",
      elevated: "#131A30",
      surface: "#131A30",
      inset: "#0D1326",
      fill: "#202944",
      fillPressed: "#2A3453",
      ink: "#EEF1FA",
      textSecondary: "#B4BCD3",
      textTertiary: "#8D96B0",
      textDisabled: "#535C78",
      accent: "#86A6FF",
      accentPressed: "#6A8CF2",
      accentSoft: "rgba(134, 166, 255, 0.16)",
      onAccent: "#061133",
      hairline: "rgba(238, 241, 250, 0.10)",
      glass: "rgba(19, 26, 48, 0.94)",
    },
    map: {
      light: {
        ground: "#F2F4F8",
        park: "#DBEEDD",
        water: "#BCD8F3",
        waterLabel: "#4E7BAA",
        road: "#FFFFFF",
        roadEdge: "#DCE1EC",
        highway: "#FFD9A8",
        label: "#4B5370",
        labelStrong: "#1C2342",
        labelMuted: "#7D849C",
        labelHalo: "#FFFFFF",
        adminLine: "#BCC4D8",
        veil: "rgba(255, 255, 255, 0.55)",
      },
      dark: {
        ground: "#111829",
        park: "#142532",
        water: "#0A1A2E",
        waterLabel: "#4B6A92",
        road: "#232C44",
        roadEdge: "#192136",
        highway: "#4D3F2A",
        label: "#8F98B2",
        labelStrong: "#D6DCEC",
        labelMuted: "#6E7690",
        labelHalo: "#111829",
        adminLine: "#2F3956",
        veil: "rgba(0, 0, 0, 0.45)",
      },
    },
  },
  clasico: {
    light: {
      paper: "#F6F6F6",
      elevated: "#FFFFFF",
      surface: "#FFFFFF",
      inset: "#F6F6F6",
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
        veil: "rgba(255, 255, 255, 0.5)",
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
        veil: "rgba(0, 0, 0, 0.45)",
      },
    },
  },
} satisfies Record<string, ThemeDefinition>;

export type ThemeId = keyof typeof THEMES;
export const DEFAULT_THEME: ThemeId = "civico";

function buildPalette(seed: Seed, scheme: "light" | "dark") {
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

/**
 * The live palettes. They are mutated in place by `applyTheme`, so code that
 * reads `palettes[scheme]` at render time picks up a theme switch once the
 * tree re-renders (the root remounts on a switch).
 */
export const palettes: { light: Palette; dark: Palette } = {
  light: buildPalette(THEMES[DEFAULT_THEME].light, "light"),
  dark: buildPalette(THEMES[DEFAULT_THEME].dark, "dark"),
};

/**
 * The basemap, as tokens: `features/map/basemap.ts` turns these into the
 * Google Maps style, so re-tinting the map is a change here, not in the style.
 */
export const mapPalettes: { light: MapPalette; dark: MapPalette } = {
  light: { ...THEMES[DEFAULT_THEME].map.light },
  dark: { ...THEMES[DEFAULT_THEME].map.dark },
};

let activeTheme: ThemeId = DEFAULT_THEME;
const themeListeners = new Set<() => void>();

/**
 * Points every token at `id`'s values and re-renders every component that
 * reads the theme through `useScheme`/`useTheme`.
 */
export function applyTheme(id: ThemeId) {
  const theme = THEMES[id];
  Object.assign(palettes.light, buildPalette(theme.light, "light"));
  Object.assign(palettes.dark, buildPalette(theme.dark, "dark"));
  Object.assign(mapPalettes.light, theme.map.light);
  Object.assign(mapPalettes.dark, theme.map.dark);
  if (id === activeTheme) return;
  activeTheme = id;
  for (const listener of themeListeners) listener();
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

/** The active theme; re-renders the caller when it changes. */
export function useThemeId(): ThemeId {
  return useSyncExternalStore(subscribeTheme, () => activeTheme);
}

export type Scheme = keyof typeof palettes;

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
export const TOUCH = Platform.select({ ios: 44, default: 48 });

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

/** Curves from the animate-expo skill. Never ease-in on UI. */
export const ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/** Timing functions for Reanimated CSS transitions (state-driven, no gesture). */
export const curve = {
  out: cubicBezier(0.23, 1, 0.32, 1),
  inOut: cubicBezier(0.77, 0, 0.175, 1),
} as const;

export const spring = {
  settle: { duration: 400, dampingRatio: 1 },
  snap: { duration: 400, dampingRatio: 0.8 },
  sheet: { duration: 300, dampingRatio: 0.8 },
} as const;

/** Elevation for floating things over the map: one soft drop, no ring. */
export function floating(scheme: Scheme) {
  return {
    shadowColor: palettes[scheme].shadow,
    shadowOpacity: scheme === "dark" ? 0.5 : 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  } as const;
}

/**
 * Cards are flat: a grey tile on white, a dark tile on black. Kept as a
 * function so a component that wants depth asks for it in one place.
 */
export function raised(_scheme: Scheme) {
  return {} as const;
}

export function useScheme(): Scheme {
  // Subscribing here makes every themed component re-render on a switch,
  // memoised or not.
  useThemeId();
  return useColorScheme() === "dark" ? "dark" : "light";
}

export function useTheme() {
  const scheme = useScheme();
  return { scheme, colors: palettes[scheme] };
}
