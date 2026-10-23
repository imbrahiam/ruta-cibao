import type { ReactNode } from "react";
import {
  Text as NativeText,
  type TextProps as NativeTextProps,
  type TextStyle,
} from "react-native";
import { type Palette, type TypeVariant, type, useTheme } from "./theme";

export type TextTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "accent"
  | "danger"
  | "success"
  | "warning"
  | "onAccent"
  | "onPine";

const TONE: Record<TextTone, keyof Palette> = {
  primary: "text",
  secondary: "textSecondary",
  tertiary: "textTertiary",
  accent: "accent",
  danger: "dangerInk",
  success: "successInk",
  warning: "warningInk",
  onAccent: "onAccent",
  onPine: "onPine",
};

export type TextProps = Omit<NativeTextProps, "style"> & {
  variant?: TypeVariant;
  tone?: TextTone;
  weight?: TextStyle["fontWeight"];
  align?: TextStyle["textAlign"];
  /** Tabular figures, for counts and times that change in place. */
  tabular?: boolean;
  uppercase?: boolean;
  style?: NativeTextProps["style"];
  children?: ReactNode;
};

/**
 * All text in the app. Variants mirror the iOS text styles and scale with the
 * user's Dynamic Type setting; layouts must never assume a fixed text height.
 */
export function Text({
  variant = "body",
  tone = "primary",
  weight,
  align,
  tabular,
  uppercase,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  return (
    <NativeText
      {...rest}
      style={[
        type[variant],
        { color: colors[TONE[tone]] },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ["tabular-nums"] } : null,
        uppercase ? { textTransform: "uppercase" } : null,
        style,
      ]}
    />
  );
}
