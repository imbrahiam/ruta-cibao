import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Icon } from "./icon";
import { type Haptic, PressableScale } from "./pressable";
import { Text } from "./text";
import { type Palette, radius, space, TOUCH, useTheme } from "./theme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "destructive"
  | "inverse";

export type ButtonSize = "lg" | "md" | "sm";

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** Shows a spinner, keeps the width, and blocks a second press. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretches to the container width. */
  block?: boolean;
  haptic?: Haptic;
  accessibilityHint?: string;
  testID?: string;
};

const HEIGHT: Record<ButtonSize, number> = { lg: 54, md: TOUCH, sm: 36 };

const COLORS: Record<
  ButtonVariant,
  { background: keyof Palette | "transparent"; text: keyof Palette }
> = {
  primary: { background: "accent", text: "onAccent" },
  secondary: { background: "fill", text: "text" },
  tertiary: { background: "transparent", text: "accent" },
  destructive: { background: "dangerSoft", text: "dangerInk" },
  inverse: { background: "text", text: "background" },
};

/**
 * One accent button per view at most; everything else is secondary or
 * tertiary. Labels are verbs from the catalogue.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  loading = false,
  disabled = false,
  block = false,
  haptic = "light",
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const tone = COLORS[variant];
  const inactive = disabled || loading;
  const background =
    tone.background === "transparent" ? "transparent" : colors[tone.background];
  const foreground = colors[tone.text];

  return (
    <PressableScale
      testID={testID}
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      haptic={haptic}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === "sm" ? 6 : 0}
      containerStyle={block ? styles.block : null}
      style={[
        styles.button,
        {
          minHeight: HEIGHT[size],
          paddingHorizontal: size === "sm" ? space.md - 2 : space.lg - 4,
          borderRadius: size === "lg" ? radius.card : radius.pill,
          backgroundColor: background,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <View style={[styles.content, loading && styles.hidden]}>
        {icon ? (
          <Icon as={icon} size={size === "sm" ? 16 : 19} color={foreground} />
        ) : null}
        <Text
          variant={size === "sm" ? "subhead" : "headline"}
          weight="600"
          style={{ color: foreground }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator style={StyleSheet.absoluteFill} color={foreground} />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: "stretch" },
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  hidden: { opacity: 0 },
});
