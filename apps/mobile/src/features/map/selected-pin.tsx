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
import { ease, useScheme } from "@/ui/theme";

const WIDTH = 48;
const HEIGHT = 50;

/**
 * The map's own disc, enlarged, with a short rounded nub pointing at the spot:
 * one path, so the white outline runs unbroken around disc and nub. A
 * 19-radius disc centred at (24, 22); the nub's sides are tangent to it and
 * meet just above the bottom edge.
 */
const DROP =
  "M11.66 36.44 A19 19 0 1 1 36.34 36.44 L25.6 45.3 Q24 46.9 22.4 45.3 Z";

/**
 * The chosen place, lifted off the map: its category disc, larger, with a nub
 * on the spot. It drops in with a little settle, over a soft ground shadow that
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
      { translateY: (1 - Math.min(drop.get(), 1)) * -12 },
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: WIDTH, height: HEIGHT + 2, alignItems: "center" },
  pin: {
    width: WIDTH,
    height: HEIGHT,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  glyph: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shadow: {
    position: "absolute",
    bottom: 0,
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#000",
  },
});
