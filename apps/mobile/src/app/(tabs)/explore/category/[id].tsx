import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useMemo } from "react";
import { RefreshControl, StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import {
  offlinePlaceListItem,
  withOfflineFallback,
} from "@/features/offline/fallback";
import { SavedCopyNotice } from "@/features/offline/saved-copy-notice";
import { offlineCategories, offlinePlaces } from "@/features/offline/store";
import { PlaceListRow } from "@/features/places/place-list-row";
import { useHiddenTargets } from "@/features/safety/hidden-targets";
import { api, orpc } from "@/lib/api";
import { EmptyState } from "@/ui/states";
import { space, useTheme } from "@/ui/theme";

export default function CategoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const t = useTranslations("explore");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  const places = useQuery({
    queryKey: [
      ...orpc.places.browse.queryOptions({ input: { category: id, limit: 48 } })
        .queryKey,
    ],
    queryFn: withOfflineFallback(
      () => api.places.browse({ category: id, limit: 48 }),
      async () => {
        const items = (await offlinePlaces({ categoryId: id })).map(
          offlinePlaceListItem,
        );
        return { items, total: items.length };
      },
    ),
  });
  const hidden = useHiddenTargets();
  const items = useMemo(
    () =>
      (places.data?.items ?? []).filter(
        (item) => !hidden.places.has(item.slug),
      ),
    [places.data, hidden.places],
  );
  // A deep link carries only the id; the name then comes from the taxonomy.
  const categories = useQuery({
    queryKey: [...orpc.places.categories.queryOptions().queryKey],
    queryFn: withOfflineFallback(
      () => api.places.categories(),
      async () =>
        (await offlineCategories()).flatMap((item) =>
          item.kind === "place" || item.kind === "business"
            ? [{ ...item, kind: item.kind }]
            : [],
        ),
    ),
    enabled: !name,
  });
  const title =
    name ?? categories.data?.find((item) => item.id === id)?.name ?? "";

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <SavedCopyNotice date={places.data?.savedCopyAt} />
        }
        refreshControl={
          <RefreshControl
            refreshing={places.isRefetching}
            onRefresh={() => void places.refetch()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          places.isPending ? null : places.isError ? (
            <EmptyState
              icon={MapPin}
              tone="danger"
              title={tc("errorTitle")}
              body={tc("errorBody")}
              action={{
                label: tc("retry"),
                onPress: () => void places.refetch(),
              }}
            />
          ) : (
            <EmptyState icon={MapPin} title={t("emptyCategory")} />
          )
        }
        renderItem={({ item }) => <PlaceListRow item={item} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.md, paddingBottom: space.xxl },
});
