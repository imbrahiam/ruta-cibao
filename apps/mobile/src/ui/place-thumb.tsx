import { Image } from "expo-image";
import { useState } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { API_ORIGIN } from "@/lib/config";
import { CategoryBadge } from "./category-badge";

export function PlaceThumb({
  thumbnailUrl,
  source: _source,
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
  const uri = thumbnailUrl
    ? new URL(thumbnailUrl, `${API_ORIGIN}/`).href
    : null;
  // Key failure to the URL so recycled rows recover immediately for a new place.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return (
    <View
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: Math.min(16, size / 4) },
        style,
      ]}
    >
      {!uri || failedUri === uri ? (
        <CategoryBadge icon={icon} color={color} size={size} />
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
