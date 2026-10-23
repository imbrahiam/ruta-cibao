import { Check, type LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Icon } from "./icon";
import { PressableScale } from "./pressable";
import { Text } from "./text";
import { type Palette, radius, space, useTheme } from "./theme";

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: LucideIcon;
  /** A category colour for the icon; selection never relies on it alone. */
  iconColor?: string;
  /** Over the map the chip needs its own lift. */
  floating?: boolean;
  testID?: string;
};

/**
 * A filter. Selected chips invert to ink and gain a check mark, so the state
 * reads without colour.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  iconColor,
  floating = false,
  testID,
}: ChipProps) {
  const { colors, scheme } = useTheme();
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      haptic="selection"
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected
            ? colors.text
            : floating
              ? colors.surface
              : colors.fill,
          borderColor: selected ? colors.text : colors.hairline,
        },
        floating && !selected
          ? {
              shadowColor: colors.shadow,
              shadowOpacity: scheme === "dark" ? 0.4 : 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }
          : null,
      ]}
    >
      {selected ? (
        <Icon
          as={Check}
          size={15}
          color={colors.background}
          strokeWidth={2.5}
        />
      ) : icon ? (
        <Icon as={icon} size={15} color={iconColor ?? colors.textSecondary} />
      ) : null}
      <Text
        variant="subhead"
        weight="500"
        style={{ color: selected ? colors.background : colors.text }}
        numberOfLines={1}
        maxFontSizeMultiplier={1.6}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const BADGE: Record<BadgeTone, { bg: keyof Palette; fg: keyof Palette }> = {
  neutral: { bg: "fill", fg: "textSecondary" },
  accent: { bg: "accentSoft", fg: "accent" },
  success: { bg: "successSoft", fg: "successInk" },
  warning: { bg: "warningSoft", fg: "warningInk" },
  danger: { bg: "dangerSoft", fg: "dangerInk" },
};

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
};

/** Status always pairs an icon or words with its colour. */
export function Badge({ label, tone = "neutral", icon }: BadgeProps) {
  const { colors } = useTheme();
  const palette = BADGE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors[palette.bg] }]}>
      {icon ? (
        <Icon as={icon} size={13} color={palette.fg} strokeWidth={2.4} />
      ) : null}
      <Text
        variant="caption"
        weight="600"
        style={{ color: colors[palette.fg] }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: space.md - 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
});
