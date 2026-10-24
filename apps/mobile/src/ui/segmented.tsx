import { Host, Text as NativeText, Picker } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { useEffect, useState } from "react";
import { type LayoutRectangle, Platform, StyleSheet, View } from "react-native";
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
 * Two to four mutually exclusive choices. On iOS this is the system
 * segmented control (SwiftUI `Picker`), so it looks, sounds and reads to
 * VoiceOver exactly like every other iOS app; elsewhere a drawn equivalent
 * whose thumb slides on the UI thread.
 */
export function Segmented<T extends string>(props: SegmentedProps<T>) {
  if (Platform.OS === "ios") return <NativeSegmented {...props} />;
  return <DrawnSegmented {...props} />;
}

function NativeSegmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  return (
    <Host matchContents={{ vertical: true }} style={styles.host}>
      <Picker
        label={accessibilityLabel}
        selection={value}
        onSelectionChange={(next) => onChange(next as T)}
        modifiers={[pickerStyle("segmented")]}
      >
        {options.map((option) => (
          <NativeText key={option.value} modifiers={[tag(option.value)]}>
            {option.label}
          </NativeText>
        ))}
      </Picker>
    </Host>
  );
}

function DrawnSegmented<T extends string>({
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
  host: { alignSelf: "stretch" },
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
