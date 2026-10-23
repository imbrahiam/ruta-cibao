import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { categoryIcon, Icon } from "@/ui/icon";
import { ease, palettes, useScheme } from "@/ui/theme";

const WIDTH = 48;
const HEIGHT = 60;

/** Teardrop path on a 48×60 canvas: a 22-radius head and a point at the bottom. */
const DROP =
  "M24 58 C24 58 4 37.5 4 24 A20 20 0 1 1 44 24 C44 37.5 24 58 24 58 Z";

/**
 * The chosen place, lifted off the map: a teardrop in the category colour that
 * drops onto its spot with a little settle, over a soft ground shadow that
 * grows as it lands. Rare and user-caused, so it may move; with reduced motion
 * it simply appears.
 */
export function SelectedPin({
  color,
  icon,
  label,
}: {
  color: string;
  icon: string;
  label: string;
}) {
  const scheme = useScheme();
  const reduced = useReducedMotion();
  const drop = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    drop.set(
      withSequence(
        withTiming(0.92, { duration: 180, easing: ease.out }),
        withSpring(1, { duration: 380, dampingRatio: 0.55 }),
      ),
    );
  }, [drop, reduced]);

  const pin = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.get() * 2),
    transform: [
      { translateY: (1 - Math.min(drop.get(), 1)) * -18 },
      { scale: 0.9 + drop.get() * 0.1 },
    ],
  }));

  const shadow = useAnimatedStyle(() => ({
    opacity: drop.get() * (scheme === "dark" ? 0.4 : 0.16),
    transform: [{ scaleX: 0.5 + drop.get() * 0.5 }],
  }));

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={label}
      pointerEvents="none"
    >
      <Animated.View style={[styles.shadow, shadow]} />
      <Animated.View style={[styles.pin, pin]}>
        <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
          <Path d={DROP} fill={color} stroke="#FFFFFF" strokeWidth={3} />
        </Svg>
        <View style={styles.glyph}>
          <Icon
            as={categoryIcon(icon)}
            size={20}
            color="#FFFFFF"
            strokeWidth={2.4}
          />
        </View>
      </Animated.View>
      <View
        style={[
          styles.dot,
          { backgroundColor: palettes[scheme].surface, borderColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: WIDTH, height: HEIGHT + 6, alignItems: "center" },
  pin: {
    width: WIDTH,
    height: HEIGHT,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  glyph: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shadow: {
    position: "absolute",
    bottom: 0,
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#000",
  },
  dot: {
    position: "absolute",
    bottom: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 2,
  },
});
