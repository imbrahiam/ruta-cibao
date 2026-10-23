import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { CategoryBadge } from "@/ui/category-badge";
import { PressableScale } from "@/ui/pressable";
import { Text } from "@/ui/text";
import { space } from "@/ui/theme";

export type PlaceRowItem = {
  slug: string;
  name: string;
  categoryName: string;
  categoryIcon: string;
  municipalityName: string;
};

/** One place in a list: category badge, name, category and municipality. */
export function PlaceListRow({ item }: { item: PlaceRowItem }) {
  return (
    <PressableScale
      onPress={() => router.push(`/place/${item.slug}`)}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.categoryName}, ${item.municipalityName}`}
      style={styles.row}
    >
      <CategoryBadge icon={item.categoryIcon} size={40} />
      <View style={styles.text}>
        <Text variant="body" weight="600" numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="footnote" tone="tertiary" numberOfLines={1}>
          {item.categoryName} · {item.municipalityName}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md - 4,
    paddingVertical: space.sm + 2,
  },
  text: { flex: 1, gap: 1 },
});
