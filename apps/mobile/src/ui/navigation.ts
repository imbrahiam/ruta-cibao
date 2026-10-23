import type { NativeStackNavigationOptions } from "expo-router/native-stack";
import { Platform } from "react-native";

/**
 * Tab roots use the system large title that collapses into the bar on scroll.
 * Content must be a scroll view with `contentInsetAdjustmentBehavior="automatic"`.
 */
export function largeTitleOptions(): NativeStackNavigationOptions {
  return {
    headerLargeTitleEnabled: true,
    headerTransparent: Platform.OS === "ios",
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
  };
}
