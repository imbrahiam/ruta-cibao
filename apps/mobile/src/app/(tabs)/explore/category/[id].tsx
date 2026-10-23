import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { MapPin } from "lucide-react-native";
import { RefreshControl, StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { PlaceListRow } from "@/features/places/place-list-row";
import { orpc } from "@/lib/api";
import { EmptyState } from "@/ui/states";
import { space, useTheme } from "@/ui/theme";

export default function CategoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const t = useTranslations("explore");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  const places = useQuery(
    orpc.places.browse.queryOptions({ input: { category: id, limit: 48 } }),
  );

  return (
    <>
      <Stack.Screen options={{ title: name ?? "" }} />
      <FlashList
        data={places.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={places.isRefetching}
            onRefresh={() => places.refetch()}
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
              action={{ label: tc("retry"), onPress: () => places.refetch() }}
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
