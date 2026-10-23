import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { Bookmark } from "lucide-react-native";
import { RefreshControl, StyleSheet } from "react-native";
import { useTranslations } from "use-intl";
import { useMe } from "@/features/auth/session";
import { PlaceListRow } from "@/features/places/place-list-row";
import { orpc } from "@/lib/api";
import { EmptyState } from "@/ui/states";
import { space, useTheme } from "@/ui/theme";

/** Places the person kept. Reached from Explore and from Account. */
export default function SavedScreen() {
  const t = useTranslations("explore");
  const { colors } = useTheme();
  const { signedIn, isPending } = useMe();
  const saved = useQuery({
    ...orpc.places.saved.queryOptions(),
    enabled: signedIn,
  });

  return (
    <>
      <Stack.Screen
        options={{ title: t("saved"), headerLargeTitleEnabled: false }}
      />
      <FlashList
        data={signedIn ? (saved.data ?? []) : []}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={saved.isRefetching}
            onRefresh={() => saved.refetch()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          isPending || saved.isPending ? null : (
            <EmptyState
              icon={Bookmark}
              title={signedIn ? t("savedEmpty") : t("savedSignedOut")}
              body={signedIn ? t("savedEmptyBody") : undefined}
              action={
                signedIn
                  ? undefined
                  : {
                      label: t("signIn"),
                      onPress: () => router.push("/sign-in"),
                    }
              }
            />
          )
        }
        renderItem={({ item }) => (
          <PlaceListRow
            item={{
              slug: item.slug,
              name: item.name,
              categoryName: item.categoryName,
              categoryIcon: item.icon,
              categoryColor: item.color,
              municipalityName: item.municipalityName,
            }}
          />
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.md, paddingBottom: space.xxl },
});
