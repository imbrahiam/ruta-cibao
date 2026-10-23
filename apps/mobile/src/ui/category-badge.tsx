import { StyleSheet, View } from "react-native";
import { categoryIcon, Icon } from "./icon";
import { useTheme } from "./theme";

/**
 * A category's glyph in a round tile, monochrome: grey tile and ink glyph, or
 * the inverse (ink tile, paper glyph) where it marks the thing on screen. The
 * category's own colour is data for the admin panel, not the app's chrome.
 */
export function CategoryBadge({
  icon,
  size = 40,
  inverse = false,
}: {
  icon: string | null | undefined;
  size?: number;
  inverse?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: inverse ? colors.accent : colors.fill,
        },
      ]}
    >
      <Icon
        as={categoryIcon(icon)}
        size={Math.round(size * 0.45)}
        color={inverse ? colors.onAccent : colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center" },
});
