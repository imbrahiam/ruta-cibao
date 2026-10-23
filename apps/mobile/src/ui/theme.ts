import { Platform, useColorScheme } from "react-native";
import { cubicBezier, Easing } from "react-native-reanimated";

/**
 * Design tokens.
 *
 * Warm paper and near-black ink, one pine accent, and nothing else coloured
 * except status and categories. Every value a component uses comes from here:
 * a one-off hex, radius or shadow is a bug.
 *
 * Contrast: text tokens pass WCAG AA (4.5:1) on `background`, `surface` and
 * `inset` in both schemes; `textTertiary` is the lightest text allowed for
 * captions. `textDisabled` is never used for information.
 */
const light = {
  background: "#FAFAF7",
  surface: "#FFFFFF",
  inset: "#F2F1EC",
  fill: "#E9E7E0",
  fillPressed: "#DEDBD2",
  separator: "#DEDBD2",
  hairline: "rgba(18, 18, 17, 0.08)",

  text: "#121211",
  textSecondary: "#57554F",
  textTertiary: "#6F6C64",
  textDisabled: "#B5B2A9",

  accent: "#1F6B52",
  accentPressed: "#175A44",
  accentSoft: "rgba(31, 107, 82, 0.10)",
  onAccent: "#FFFFFF",

  pine: "#183F32",
  onPine: "#F3F2EE",

  success: "#2E9E6B",
  successInk: "#1E6E4A",
  successSoft: "rgba(46, 158, 107, 0.12)",
  warning: "#C98A1B",
  warningInk: "#8A5A08",
  warningSoft: "rgba(201, 138, 27, 0.14)",
  danger: "#D4483A",
  dangerInk: "#B0352A",
  dangerSoft: "rgba(212, 72, 58, 0.10)",

  locate: "#2F5BFF",
  glass: "rgba(255, 255, 255, 0.82)",
  scrim: "rgba(18, 18, 17, 0.28)",
  shadow: "#121211",
} as const;

export type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  background: "#121211",
  surface: "#1C1C1A",
  inset: "#1A1A18",
  fill: "#262623",
  fillPressed: "#2E2E2B",
  separator: "#2E2E2B",
  hairline: "rgba(255, 255, 255, 0.08)",

  text: "#F3F2EE",
  textSecondary: "#C2BFB6",
  textTertiary: "#9C998F",
  textDisabled: "#57554F",

  accent: "#5FBF9A",
  accentPressed: "#7DD0B0",
  accentSoft: "rgba(95, 191, 154, 0.16)",
  onAccent: "#121211",

  pine: "#183F32",
  onPine: "#F3F2EE",

  success: "#4CC28C",
  successInk: "#7DD8AE",
  successSoft: "rgba(76, 194, 140, 0.16)",
  warning: "#E0A33A",
  warningInk: "#F0C274",
  warningSoft: "rgba(224, 163, 58, 0.16)",
  danger: "#F06A5C",
  dangerInk: "#FF9488",
  dangerSoft: "rgba(240, 106, 92, 0.16)",

  locate: "#5C7DFF",
  glass: "rgba(28, 28, 26, 0.82)",
  scrim: "rgba(0, 0, 0, 0.5)",
  shadow: "#000000",
};

export const palettes = { light, dark } as const;

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

/** Elevation for floating things over the map: ring plus soft drop. */
export function floating(scheme: Scheme) {
  return {
    shadowColor: palettes[scheme].shadow,
    shadowOpacity: scheme === "dark" ? 0.45 : 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } as const;
}

/** Cards sit on paper with a hairline and the faintest lift. */
export function raised(scheme: Scheme) {
  return {
    shadowColor: palettes[scheme].shadow,
    shadowOpacity: scheme === "dark" ? 0.3 : 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  } as const;
}

export function useScheme(): Scheme {
  return useColorScheme() === "dark" ? "dark" : "light";
}

export function useTheme() {
  const scheme = useScheme();
  return { scheme, colors: palettes[scheme] };
}
