import { Platform, useColorScheme } from "react-native";
import { cubicBezier, Easing } from "react-native-reanimated";

/**
 * Design tokens.
 *
 * Monochrome by default: white and black, a short ladder of greys, and colour
 * only where it carries meaning (traffic severity, success, warning, error,
 * "you are here"). Every value a component uses comes from here: a one-off
 * hex, radius or shadow is a bug.
 *
 * To re-skin the app, change the knobs in `brand` below. `accent` drives the
 * primary buttons, selected chips, links and focus; `pin` drives the place
 * markers on the map (keep it equal to `ink` for the monochrome map even when
 * `accent` becomes a colour). The basemap itself is themed by `mapPalettes`.
 *
 * Contrast: text tokens pass WCAG AA (4.5:1) on `background`, `surface` and
 * `inset` in both schemes; `textTertiary` is the lightest text allowed for
 * captions. `textDisabled` is never used for information. A new `accent` must
 * keep 4.5:1 against `onAccent` and 3:1 against `background`.
 */
export const brand = {
  light: {
    paper: "#FFFFFF",
    ink: "#000000",
    accent: "#000000",
    accentPressed: "#333333",
    onAccent: "#FFFFFF",
    pin: "#000000",
    onPin: "#FFFFFF",
  },
  dark: {
    paper: "#000000",
    ink: "#FFFFFF",
    accent: "#FFFFFF",
    accentPressed: "#DDDDDD",
    onAccent: "#000000",
    pin: "#FFFFFF",
    onPin: "#000000",
  },
} as const;

const light = {
  background: brand.light.paper,
  /** Things floating over the map or content: sheets, search bar, map buttons. */
  elevated: brand.light.paper,
  // Tiles, inputs and grouped rows sit on white as a light grey, the way Uber
  // and Google Maps separate content in light mode without borders or shadows.
  surface: "#F3F3F3",
  inset: "#F6F6F6",
  fill: "#E8E8E8",
  fillPressed: "#DCDCDC",
  separator: "#E8E8E8",
  hairline: "rgba(0, 0, 0, 0.08)",

  text: brand.light.ink,
  textSecondary: "#545454",
  textTertiary: "#6B6B6B",
  textDisabled: "#AFAFAF",

  accent: brand.light.accent,
  accentPressed: brand.light.accentPressed,
  accentSoft: "rgba(0, 0, 0, 0.06)",
  onAccent: brand.light.onAccent,

  pin: brand.light.pin,
  onPin: brand.light.onPin,
  /** Glyphs and text on a status colour (traffic severity, badges). */
  onStatus: "#FFFFFF",

  pine: brand.light.ink,
  onPine: brand.light.paper,

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
  glass: "rgba(255, 255, 255, 0.94)",
  scrim: "rgba(0, 0, 0, 0.32)",
  shadow: "#000000",
} as const;

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  background: brand.dark.paper,
  elevated: "#1C1C1C",
  surface: "#1C1C1C",
  inset: "#141414",
  fill: "#2B2B2B",
  fillPressed: "#363636",
  separator: "#2B2B2B",
  hairline: "rgba(255, 255, 255, 0.10)",

  text: brand.dark.ink,
  textSecondary: "#BDBDBD",
  textTertiary: "#9A9A9A",
  textDisabled: "#5E5E5E",

  accent: brand.dark.accent,
  accentPressed: brand.dark.accentPressed,
  accentSoft: "rgba(255, 255, 255, 0.10)",
  onAccent: brand.dark.onAccent,

  pin: brand.dark.pin,
  onPin: brand.dark.onPin,
  onStatus: "#FFFFFF",

  pine: brand.dark.ink,
  onPine: brand.dark.paper,

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
  glass: "rgba(28, 28, 28, 0.94)",
  scrim: "rgba(0, 0, 0, 0.55)",
  shadow: "#000000",
};

export const palettes = { light, dark } as const;

/**
 * The basemap, as tokens: `features/map/google-style.ts` turns these into the
 * Google Maps style, so re-tinting the map is a change here, not in the style.
 */
export const mapPalettes = {
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
    /** Dims the country around the province. */
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
} as const;

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
  return useColorScheme() === "dark" ? "dark" : "light";
}

export function useTheme() {
  const scheme = useScheme();
  return { scheme, colors: palettes[scheme] };
}
