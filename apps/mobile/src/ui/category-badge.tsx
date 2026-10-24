import { StyleSheet, View } from "react-native";
import { categoryIcon, Icon } from "./icon";
import { useTheme } from "./theme";

/**
 * A category's glyph in a round tile. With the category's colour (taxonomy
 * data an admin edits), the tile is a soft wash of it and the glyph is the
 * colour itself, matching the pin on the map; `inverse` makes it solid with a
 * white glyph, for the thing that is selected. Without a colour it falls back
 * to the neutral grey tile.
 */
export function CategoryBadge({
  icon,
  color,
  size = 40,
  inverse = false,
}: {
  icon: string | null | undefined;
  color?: string | null;
  size?: number;
  inverse?: boolean;
}) {
  const { colors, scheme } = useTheme();
  const tint = color && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
  const background = tint
    ? inverse
      ? tint
      : `${tint}${scheme === "dark" ? "33" : "1F"}`
    : inverse
      ? colors.accent
      : colors.fill;
  const glyph = tint
    ? inverse
      ? colors.onStatus
      : tint
    : inverse
      ? colors.onAccent
      : colors.text;
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
        },
      ]}
    >
      <Icon
        as={categoryIcon(icon)}
        size={Math.round(size * 0.45)}
        color={glyph}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center" },
});
