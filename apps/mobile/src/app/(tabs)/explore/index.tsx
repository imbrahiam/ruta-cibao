import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import {
  Bookmark,
  Clock,
  Footprints,
  Mountain,
  Search,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { PlaceListRow } from "@/features/places/place-list-row";
import { orpc } from "@/lib/api";
import { API_ORIGIN } from "@/lib/config";
import { mediaUrl } from "@/lib/ids";
import { categoryIcon, Icon } from "@/ui/icon";
import { PressableScale } from "@/ui/pressable";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card, IconButton } from "@/ui/surfaces";
import { Chip } from "@/ui/tags";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";

/** Lowercase, accents removed: "Monción" and "moncion" are the same word. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export default function ExploreScreen() {
  const t = useTranslations("explore");
  const tc = useTranslations("common");
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [municipality, setMunicipality] = useState<string | null>(null);

  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const categories = useQuery(orpc.places.categories.queryOptions());
  const places = useQuery(
    orpc.places.browse.queryOptions({
      input: { municipality: municipality ?? "", limit: 48 },
    }),
  );
  const routes = useQuery(
    orpc.routes.browse.queryOptions({
      input: { municipalityId: municipality ?? undefined, limit: 20 },
    }),
  );

  const needle = fold(query.trim());
  const items = places.data?.items ?? [];
  const matches = useMemo(
    () =>
      needle
        ? items.filter((item) =>
            fold(
              `${item.name} ${item.categoryName} ${item.municipalityName}`,
            ).includes(needle),
          )
        : [],
    [items, needle],
  );
  const businessIds = new Set(
    (categories.data ?? [])
      .filter((c) => c.kind === "business")
      .map((c) => c.id),
  );
  const businesses = items.filter((item) => businessIds.has(item.categoryId));
  const highlights = items.filter((item) => item.imageUrl);
  const counts = new Map<string, number>();
  for (const item of items)
    counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);

  const refreshing = places.isRefetching || routes.isRefetching;
  const refresh = () => {
    places.refetch();
    routes.refetch();
    categories.refetch();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("title"),
          headerSearchBarOptions: {
            placeholder: t("searchPlaceholder"),
            onChangeText: (event) => setQuery(event.nativeEvent.text),
            onCancelButtonPress: () => setQuery(""),
          },
          headerRight: () => (
            <IconButton
              icon={Bookmark}
              label={t("saved")}
              size={36}
              onPress={() => router.push("/explore/saved")}
              testID="explore-saved"
            />
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={tc("allMunicipalities")}
            selected={municipality === null}
            onPress={() => setMunicipality(null)}
          />
          {(municipalities.data ?? []).map((item) => (
            <Chip
              key={item.id}
              label={item.name}
              selected={municipality === item.id}
              onPress={() =>
                setMunicipality(municipality === item.id ? null : item.id)
              }
            />
          ))}
        </ScrollView>

        {needle ? (
          <View style={styles.section}>
            <Text
              variant="footnote"
              tone="tertiary"
              uppercase
              style={styles.pad}
            >
              {t("results", { count: matches.length })}
            </Text>
            {matches.length === 0 ? (
              <EmptyState
                icon={Search}
                title={t("noResults")}
                body={t("noResultsBody")}
              />
            ) : (
              <View style={styles.list}>
                {matches.map((item) => (
                  <PlaceListRow key={item.id} item={item} />
                ))}
              </View>
            )}
          </View>
        ) : places.isError ? (
          <EmptyState
            icon={Search}
            tone="danger"
            title={tc("errorTitle")}
            body={tc("errorBody")}
            action={{ label: tc("retry"), onPress: refresh }}
          />
        ) : (
          <>
            <Section title={t("highlights")}>
              {places.isPending ? (
                <Skeleton width={280} height={220} rounded={radius.card} />
              ) : (
                highlights.map((item) => (
                  <PressableScale
                    key={item.id}
                    onPress={() => router.push(`/place/${item.slug}`)}
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${item.categoryName}, ${item.municipalityName}`}
                    style={styles.feature}
                  >
                    <Image
                      source={mediaUrl(item.imageUrl ?? "", API_ORIGIN)}
                      style={[
                        styles.featureImage,
                        { backgroundColor: colors.fill },
                      ]}
                      contentFit="cover"
                      transition={200}
                    />
                    <View style={styles.featureText}>
                      <Text variant="headline" numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text variant="subhead" tone="tertiary" numberOfLines={1}>
                        {item.categoryName} · {item.municipalityName}
                      </Text>
                    </View>
                  </PressableScale>
                ))
              )}
            </Section>

            <View style={styles.section}>
              <Text
                variant="title3"
                accessibilityRole="header"
                style={styles.pad}
              >
                {t("categories")}
              </Text>
              <View style={styles.grid}>
                {categories.isPending
                  ? [0, 1, 2, 3].map((key) => (
                      <View key={key} style={styles.tileWrap}>
                        <Skeleton height={92} rounded={radius.card} />
                      </View>
                    ))
                  : (categories.data ?? [])
                      .filter((category) => (counts.get(category.id) ?? 0) > 0)
                      .map((category) => (
                        <View key={category.id} style={styles.tileWrap}>
                          <Card
                            onPress={() =>
                              router.push({
                                pathname: "/explore/category/[id]",
                                params: {
                                  id: category.id,
                                  name: category.name,
                                },
                              })
                            }
                            accessibilityLabel={category.name}
                            style={styles.tile}
                          >
                            <View
                              style={[
                                styles.tileIcon,
                                { backgroundColor: category.color },
                              ]}
                            >
                              <Icon
                                as={categoryIcon(category.icon)}
                                size={18}
                                color="#FFFFFF"
                              />
                            </View>
                            <Text
                              variant="subhead"
                              weight="600"
                              numberOfLines={2}
                            >
                              {category.name}
                            </Text>
                            <Text variant="footnote" tone="tertiary">
                              {t("placesCount", {
                                count: counts.get(category.id) ?? 0,
                              })}
                            </Text>
                          </Card>
                        </View>
                      ))}
              </View>
            </View>

            {businesses.length > 0 ? (
              <Section title={t("businesses")}>
                {businesses.map((item) => (
                  <Card
                    key={item.id}
                    style={styles.smallCard}
                    onPress={() => router.push(`/place/${item.slug}`)}
                    accessibilityLabel={item.name}
                  >
                    <View
                      style={[
                        styles.tileIcon,
                        { backgroundColor: item.categoryColor },
                      ]}
                    >
                      <Icon
                        as={categoryIcon(item.categoryIcon)}
                        size={18}
                        color="#FFFFFF"
                      />
                    </View>
                    <Text variant="subhead" weight="600" numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text variant="footnote" tone="tertiary" numberOfLines={1}>
                      {item.categoryName} · {item.municipalityName}
                    </Text>
                  </Card>
                ))}
              </Section>
            ) : null}

            <Section title={t("routes")}>
              {routes.isPending ? (
                <Skeleton width={260} height={130} rounded={radius.card} />
              ) : (routes.data?.items ?? []).length === 0 ? (
                <Card style={styles.emptyRoutes}>
                  <Icon as={Mountain} size={22} color="textTertiary" />
                  <Text variant="subhead" tone="secondary" style={styles.flex}>
                    {t("noRoutes")}
                  </Text>
                </Card>
              ) : (
                (routes.data?.items ?? []).map((route) => (
                  <Card
                    key={route.id}
                    style={styles.routeCard}
                    onPress={() => router.push(`/route/${route.id}`)}
                    accessibilityLabel={route.name}
                  >
                    <View
                      style={[
                        styles.tileIcon,
                        { backgroundColor: colors.success },
                      ]}
                    >
                      <Icon as={Footprints} size={18} color="#FFFFFF" />
                    </View>
                    <Text variant="headline" numberOfLines={2}>
                      {route.name}
                    </Text>
                    <View style={styles.routeMeta}>
                      <Icon as={Clock} size={14} color="textTertiary" />
                      <Text variant="footnote" tone="tertiary">
                        {t("duration", {
                          hours: Math.floor(route.durationMinutes / 60),
                          minutes: route.durationMinutes % 60,
                        })}{" "}
                        · {(route.distanceMeters / 1000).toFixed(1)} km ·{" "}
                        {t(`difficulty.${route.difficulty}`)}
                      </Text>
                    </View>
                  </Card>
                ))
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text variant="title3" accessibilityRole="header" style={styles.pad}>
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl + space.xl, gap: space.lg },
  flex: { flex: 1 },
  pad: { paddingHorizontal: space.md },
  chips: { gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm },
  section: { gap: space.sm + 4 },
  rail: { gap: space.sm + 4, paddingHorizontal: space.md },
  list: { paddingHorizontal: space.md },
  feature: { width: 280, gap: space.sm },
  featureImage: {
    width: 280,
    height: 180,
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  featureText: { gap: 2, paddingHorizontal: 2 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: space.md - space.xs,
  },
  tileWrap: { width: "50%", padding: space.xs },
  tile: { gap: space.sm, minHeight: 112 },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  smallCard: { width: 168, gap: space.sm },
  routeCard: { width: 260, gap: space.sm },
  routeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  emptyRoutes: {
    width: 320,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md - 4,
  },
});
