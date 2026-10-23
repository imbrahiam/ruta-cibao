import type { LucideIcon } from "lucide-react-native";
import { type DimensionValue, StyleSheet, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { Button } from "./button";
import { Icon } from "./icon";
import { Text } from "./text";
import { radius, space, useTheme } from "./theme";

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  tone?: "neutral" | "danger";
};

/** What a screen says when there is nothing, or when something failed. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = "neutral",
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty} accessible accessibilityRole="summary">
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor:
              tone === "danger" ? colors.dangerSoft : colors.accentSoft,
          },
        ]}
      >
        <Icon
          as={icon}
          size={26}
          color={tone === "danger" ? "dangerInk" : "accent"}
        />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      {body ? (
        <Text tone="secondary" align="center" style={styles.emptyBody}>
          {body}
        </Text>
      ) : null}
      {action ? (
        <View style={styles.emptyAction}>
          <Button
            label={action.label}
            onPress={action.onPress}
            variant="secondary"
            size="md"
          />
        </View>
      ) : null}
    </View>
  );
}

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
};

/**
 * Placeholder while content loads, shaped like what is coming. A slow breathe,
 * not a sweeping shimmer; static when the system asks for reduced motion.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  rounded = radius.sm,
}: SkeletonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: rounded,
          backgroundColor: colors.fill,
        },
        reduced
          ? null
          : {
              animationName: { from: { opacity: 1 }, to: { opacity: 0.55 } },
              animationDuration: "900ms",
              animationIterationCount: "infinite",
              animationDirection: "alternate",
              animationTimingFunction: "ease-in-out",
            },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
    gap: space.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  emptyBody: { maxWidth: 320 },
  emptyAction: { marginTop: space.md },
});
