import * as Haptics from "expo-haptics";
import { type ReactNode, useState } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { curve } from "./theme";

export type Haptic = "selection" | "light" | "medium" | "success" | "none";

export function haptic(kind: Haptic) {
  switch (kind) {
    case "selection":
      return Haptics.selectionAsync();
    case "light":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case "medium":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case "success":
      return Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
    case "none":
      return undefined;
  }
}

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  /** Applied to the outer touch area, e.g. flex sizing in a row. */
  containerStyle?: StyleProp<ViewStyle>;
  /** How far it presses in. 0.97 for buttons, 0.985 for large cards. */
  scaleTo?: number;
  haptic?: Haptic;
  children: ReactNode;
};

/**
 * Every tappable thing. Feedback lands on press-in (120 ms, 3%), the action on
 * release; a finger that drifts a little does not cancel. No animation runs per
 * frame: two state changes per press drive a native style transition.
 */
export function PressableScale({
  style,
  containerStyle,
  scaleTo = 0.97,
  haptic: hapticKind = "none",
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={containerStyle}
      pressRetentionOffset={16}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        haptic(hapticKind);
        onPress?.(event);
      }}
    >
      <Animated.View
        style={[
          style,
          {
            transitionProperty: "transform",
            transitionDuration: 120,
            transitionTimingFunction: curve.out,
            transform: [{ scale: pressed && !disabled ? scaleTo : 1 }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
