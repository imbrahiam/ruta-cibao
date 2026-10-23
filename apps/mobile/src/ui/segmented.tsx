import { useEffect, useState } from "react";
import { type LayoutRectangle, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { PressableScale } from "./pressable";
import { Text } from "./text";
import { ease, radius, raised, space, useTheme } from "./theme";

export type SegmentedProps<T extends string> = {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/**
 * Two to four mutually exclusive choices. The thumb slides between measured
 * segments on the UI thread; with reduced motion it jumps.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<T, LayoutRectangle>>>(
    {},
  );
  const x = useSharedValue(0);
  const width = useSharedValue(0);

  useEffect(() => {
    const layout = layouts[value];
    if (!layout) return;
    const config = { duration: reduced ? 0 : 240, easing: ease.inOut };
    x.set(withTiming(layout.x, config));
    width.set(withTiming(layout.width, config));
  }, [layouts, value, reduced, x, width]);

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    width: width.get(),
  }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.fill }]}
    >
      <Animated.View
        style={[
          styles.thumb,
          raised(scheme),
          { backgroundColor: colors.surface },
          thumb,
        ]}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            containerStyle={styles.segment}
            onLayout={(event) => {
              const layout = event.nativeEvent.layout;
              setLayouts((current) => ({ ...current, [option.value]: layout }));
            }}
            onPress={() => onChange(option.value)}
            haptic="selection"
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={styles.segmentInner}
          >
            <Text
              variant="subhead"
              weight={selected ? "600" : "500"}
              tone={selected ? "primary" : "secondary"}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: radius.input,
    borderCurve: "continuous",
    padding: 3,
  },
  thumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: radius.input - 3,
    borderCurve: "continuous",
  },
  segment: { flex: 1 },
  segmentInner: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
});
