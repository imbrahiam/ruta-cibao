import { Image } from "expo-image";
import { useState } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { API_ORIGIN } from "@/lib/config";
import { CategoryBadge } from "./category-badge";
import { categoryIcon, Icon } from "./icon";
import { useTheme } from "./theme";

/**
 * A place's picture: its own photo, or Google's for places that exist there,
 * or, failing both, its category. Small sizes fall back to the round badge;
 * large tiles to a wash of the category colour with its glyph, so a card
 * without a photo still reads as a card, not a giant icon.
 */
export function PlaceThumb({
  thumbnailUrl,
  icon,
  color,
  size = 40,
  style,
}: {
  thumbnailUrl?: string | null;
  source?: "app" | "google" | null;
  icon: string | null | undefined;
  color?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, scheme } = useTheme();
  const uri = thumbnailUrl
    ? new URL(thumbnailUrl, `${API_ORIGIN}/`).href
    : null;
  // Key failure to the URL so recycled rows recover immediately for a new place.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const missing = !uri || failedUri === uri;
  const tile = size > 64;
  const tint = color && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
  return (
    <View
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: Math.min(16, size / 4) },
        missing && tile
          ? {
              backgroundColor: tint
                ? `${tint}${scheme === "dark" ? "33" : "1F"}`
                : colors.fill,
            }
          : null,
        style,
      ]}
    >
      {missing ? (
        tile ? (
          <Icon
            as={categoryIcon(icon)}
            size={Math.round(size * 0.28)}
            color={tint ?? colors.textSecondary}
          />
        ) : (
          <CategoryBadge icon={icon} color={color} size={size} />
        )
      ) : (
        <Image
          source={uri}
          recyclingKey={uri}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setFailedUri(uri)}
          accessible={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
