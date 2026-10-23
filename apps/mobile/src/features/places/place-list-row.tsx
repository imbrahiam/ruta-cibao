import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { categoryIcon, Icon } from "@/ui/icon";
import { PressableScale } from "@/ui/pressable";
import { Text } from "@/ui/text";
import { space } from "@/ui/theme";

export type PlaceRowItem = {
  slug: string;
  name: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  municipalityName: string;
};

/** One place in a list: category disc, name, category and municipality. */
export function PlaceListRow({ item }: { item: PlaceRowItem }) {
  return (
    <PressableScale
      onPress={() => router.push(`/place/${item.slug}`)}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.categoryName}, ${item.municipalityName}`}
      style={styles.row}
    >
      <View style={[styles.icon, { backgroundColor: item.categoryColor }]}>
        <Icon as={categoryIcon(item.categoryIcon)} size={18} color="#FFFFFF" />
      </View>
      <View style={styles.text}>
        <Text variant="headline" numberOfLines={1}>
          {item.name}
        </Text>
        <Text variant="subhead" tone="tertiary" numberOfLines={1}>
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
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 2 },
});
