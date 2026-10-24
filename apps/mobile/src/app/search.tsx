import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useBoundaries, usePlaceCollection } from "@/features/map/data";
import { focusOnMap } from "@/features/map/focus";
import { SavedCopyNotice } from "@/features/offline/saved-copy-notice";
import { offlineSearch } from "@/features/offline/store";
import { useHiddenTargets } from "@/features/safety/hidden-targets";
import { CategoryBadge } from "@/ui/category-badge";
import { PressableScale } from "@/ui/pressable";
import { EmptyState } from "@/ui/states";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";

/** Lowercase, accents removed: "Monción" and "moncion" are the same word. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Search over the province's published places. Local first: it works offline
 * and answers as you type; nothing is sent per keystroke.
 */
export default function SearchScreen() {
  const t = useTranslations("search");
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const places = usePlaceCollection();
  const boundaries = useBoundaries();
  const hidden = useHiddenTargets();
  const savedSearch = useQuery({
    queryKey: ["offline", "search", query],
    queryFn: () => offlineSearch(query),
    enabled: Boolean(places.data?.savedCopyAt),
  });

  const names = useMemo(
    () =>
      new Map(
        (boundaries.data?.features ?? []).map((feature) => [
          feature.properties.id,
          feature.properties.name,
        ]),
      ),
    [boundaries.data],
  );

  const results = useMemo(() => {
    if (places.data?.savedCopyAt) {
      return (savedSearch.data ?? [])
        .filter((place) => !hidden.places.has(place.slug))
        .map((place) => ({
          type: "Feature" as const,
          id: place.id,
          geometry: {
            type: "Point" as const,
            coordinates: [place.location.lng, place.location.lat],
          },
          properties: {
            id: place.id,
            slug: place.slug,
            name: place.name,
            category: place.category.id,
            categoryName: place.category.name,
            municipality: place.municipality.id,
            color: place.category.color,
            icon: place.category.icon,
          },
        }));
    }
    const needle = fold(query.trim());
    const all = places.data?.features ?? [];
    if (!needle) return all;
    return all.filter((feature) => {
      const { name, categoryName, municipality } = feature.properties;
      return fold(
        `${name} ${categoryName} ${names.get(municipality) ?? ""}`,
      ).includes(needle);
    });
  }, [places.data, query, names, savedSearch.data, hidden.places]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: t("title"),
          headerLargeTitleEnabled: false,
          headerSearchBarOptions: {
            placeholder: t("placeholder"),
            autoFocus: true,
            hideWhenScrolling: false,
            onChangeText: (event) => setQuery(event.nativeEvent.text),
          },
        }}
      />
      <FlashList
        data={results}
        keyExtractor={(item) => item.properties.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <SavedCopyNotice date={places.data?.savedCopyAt} />
            {query.trim() ? (
              <Text
                variant="footnote"
                tone="tertiary"
                uppercase
                style={styles.header}
              >
                {t("results", { count: results.length })}
              </Text>
            ) : (
              <Text
                variant="footnote"
                tone="tertiary"
                uppercase
                style={styles.header}
              >
                {t("everything")}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          places.isPending ? null : (
            <EmptyState
              icon={Search}
              title={t("emptyTitle")}
              body={t("emptyBody")}
            />
          )
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => {
              focusOnMap("place", item.properties.id);
              router.back();
            }}
            scaleTo={0.985}
            accessibilityRole="button"
            accessibilityLabel={`${item.properties.name}, ${item.properties.categoryName}`}
            style={styles.row}
          >
            <CategoryBadge icon={item.properties.icon} size={40} />
            <View style={styles.text}>
              <Text variant="body" weight="600" numberOfLines={1}>
                {item.properties.name}
              </Text>
              <Text variant="footnote" tone="tertiary" numberOfLines={1}>
                {item.properties.categoryName} ·{" "}
                {names.get(item.properties.municipality) ?? ""}
              </Text>
            </View>
          </PressableScale>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: space.md, paddingBottom: space.xxl },
  header: { paddingTop: space.md, paddingBottom: space.sm, letterSpacing: 0.4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md - 4,
    paddingVertical: space.sm + 2,
  },
  text: { flex: 1, gap: 2 },
});
