import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { Icon } from "./icon";
import { type Haptic, PressableScale } from "./pressable";
import {
  floating,
  type Palette,
  radius,
  raised,
  space,
  TOUCH,
  useTheme,
} from "./theme";

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/** Content on paper: white surface, hairline ring, the faintest lift. */
export function Card({
  children,
  onPress,
  style,
  padded = true,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CardProps) {
  const { colors, scheme } = useTheme();
  const surface = [
    styles.card,
    raised(scheme),
    {
      backgroundColor: colors.surface,
      borderColor: colors.hairline,
      padding: padded ? space.md : 0,
    },
    style,
  ];
  if (!onPress) {
    return (
      <View style={surface} testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      scaleTo={0.985}
      haptic="none"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={surface}
    >
      {children}
    </PressableScale>
  );
}

export type IconButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  /** `glass` floats over the map; `plain` sits in content; `filled` is the accent. */
  variant?: "glass" | "plain" | "filled" | "tinted";
  size?: number;
  iconColor?: keyof Palette;
  haptic?: Haptic;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
};

/** A round, labelled control. The label is what VoiceOver says. */
export function IconButton({
  icon,
  label,
  onPress,
  variant = "plain",
  size = TOUCH,
  iconColor,
  haptic = "light",
  selected,
  disabled,
  testID,
}: IconButtonProps) {
  const { colors, scheme } = useTheme();
  const glyphSize = Math.round(size * 0.44);
  const color =
    iconColor ??
    (variant === "filled"
      ? "onAccent"
      : variant === "tinted"
        ? "accent"
        : "text");
  const base: StyleProp<ViewStyle> = [
    styles.round,
    { width: size, height: size, borderRadius: size / 2 },
  ];

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      hitSlop={size < TOUCH ? (TOUCH - size) / 2 : 0}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={[
        base,
        variant === "glass" && [
          floating(scheme),
          { backgroundColor: colors.surface, borderColor: colors.hairline },
        ],
        variant === "plain" && { backgroundColor: colors.fill },
        variant === "filled" && { backgroundColor: colors.accent },
        variant === "tinted" && { backgroundColor: colors.accentSoft },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Icon as={icon} size={glyphSize} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  round: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
  },
});
