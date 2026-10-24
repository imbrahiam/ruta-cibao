import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { Clock, MessageSquareText, ThumbsUp } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTranslations } from "use-intl";
import { useMe, useMemberAction } from "@/features/auth/session";
import {
  type ConsultationStatus,
  STATUS_STYLE,
  STATUSES,
} from "@/features/consultations/status";
import { useHiddenTargets } from "@/features/safety/hidden-targets";
import { useAgo } from "@/i18n/ago";
import { orpc } from "@/lib/api";
import { CategoryBadge } from "@/ui/category-badge";
import { Icon } from "@/ui/icon";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card } from "@/ui/surfaces";
import { Badge, Chip } from "@/ui/tags";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";

export default function ConsultationsScreen() {
  const t = useTranslations("consultations");
  const tc = useTranslations("common");
  const ts = useTranslations("safety");
  const ago = useAgo();
  const { colors } = useTheme();
  const { signedIn } = useMe();
  const asMember = useMemberAction();
  const [municipality, setMunicipality] = useState<string | null>(null);
  const [status, setStatus] = useState<ConsultationStatus | null>(null);

  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const list = useQuery(
    orpc.consultations.browse.queryOptions({
      input: {
        municipality: municipality ?? "",
        status: status ?? undefined,
        limit: 48,
      },
    }),
  );
  const mine = useQuery({
    ...orpc.consultations.browse.queryOptions({
      input: {
        municipality: municipality ?? "",
        status: status ?? undefined,
        mine: true,
        limit: 20,
      },
    }),
    enabled: signedIn,
  });
  const hidden = useHiddenTargets();
  const items = useMemo(() => {
    const published = (list.data?.items ?? []).filter(
      (item) => !hidden.consultations.has(item.slug),
    );
    const seen = new Set(published.map((item) => item.id));
    const ownUnpublished = signedIn
      ? (mine.data?.items ?? []).filter((item) => !seen.has(item.id))
      : [];
    return [...ownUnpublished, ...published];
  }, [list.data, mine.data, signedIn, hidden.consultations]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t("title"),
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "plus" : undefined}
          accessibilityLabel={t("new")}
          onPress={() => asMember(() => router.push("/consultation/new"))}
        >
          {t("new")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching || mine.isRefetching}
            onRefresh={() => {
              void list.refetch();
              if (signedIn) void mine.refetch();
            }}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.filters}>
            <Text tone="secondary" style={styles.lede}>
              {t("lede")}
            </Text>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <Chip
                label={t("anyStatus")}
                selected={status === null}
                onPress={() => setStatus(null)}
              />
              {STATUSES.map((item) => (
                <Chip
                  key={item}
                  label={t(`statusLabel.${item}`)}
                  icon={STATUS_STYLE[item].icon}
                  selected={status === item}
                  onPress={() => setStatus(status === item ? null : item)}
                />
              ))}
            </ScrollView>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          list.isPending ? (
            <View style={styles.skeletons}>
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} height={132} rounded={radius.card} />
              ))}
            </View>
          ) : list.isError ? (
            <EmptyState
              icon={MessageSquareText}
              tone="danger"
              title={tc("errorTitle")}
              body={tc("errorBody")}
              action={{
                label: tc("retry"),
                onPress: () => void list.refetch(),
              }}
            />
          ) : (
            <EmptyState
              icon={MessageSquareText}
              title={t("empty")}
              body={t("emptyBody")}
              action={{
                label: t("new"),
                onPress: () => asMember(() => router.push("/consultation/new")),
              }}
            />
          )
        }
        renderItem={({ item }) => {
          const style = STATUS_STYLE[item.status];
          return (
            <Card
              onPress={() => router.push(`/consultation/${item.slug}`)}
              accessibilityLabel={`${item.title}. ${t(`statusLabel.${item.status}`)}. ${t("supports", { count: item.supportCount })}`}
              style={styles.card}
              testID={`consultation-${item.slug}`}
            >
              <View style={styles.cardTop}>
                <CategoryBadge
                  icon={item.categoryIcon}
                  color={item.categoryColor}
                  size={26}
                />
                <Text
                  variant="footnote"
                  tone="tertiary"
                  style={styles.flex}
                  numberOfLines={1}
                >
                  {item.categoryName} · {item.municipalityName}
                </Text>
                <Badge
                  label={t(`statusLabel.${item.status}`)}
                  tone={style.tone}
                  icon={style.icon}
                />
              </View>
              <Text variant="headline" numberOfLines={3}>
                {item.title}
              </Text>
              {item.publicationStatus === "published" ? null : (
                <View style={styles.cardTop}>
                  <Badge
                    label={ts(`publication.${item.publicationStatus}`)}
                    tone="warning"
                    icon={Clock}
                  />
                </View>
              )}
              <View style={styles.cardBottom}>
                <View style={styles.support}>
                  <Icon
                    as={ThumbsUp}
                    size={15}
                    color={item.supported ? "accent" : "textTertiary"}
                  />
                  <Text
                    variant="footnote"
                    tone={item.supported ? "accent" : "tertiary"}
                    weight="600"
                    tabular
                  >
                    {t("supports", { count: item.supportCount })}
                  </Text>
                </View>
                <Text variant="footnote" tone="tertiary">
                  {ago(item.createdAt)}
                </Text>
              </View>
            </Card>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.md, paddingBottom: space.xxl + space.xl },
  flex: { flex: 1 },
  filters: { gap: space.sm + 2, paddingBottom: space.md, paddingTop: space.xs },
  lede: { paddingBottom: space.xs },
  chips: { gap: space.sm },
  gap: { height: space.sm + 4 },
  skeletons: { gap: space.sm + 4 },
  card: { gap: space.sm + 2 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  catIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  support: { flexDirection: "row", alignItems: "center", gap: 6 },
});
