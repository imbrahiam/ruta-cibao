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
        {/* Status filter as the system menu, so the list keeps one row of
            chips (where the case is) and the status is one tap away. */}
        <Stack.Toolbar.Menu
          icon={
            Platform.OS === "ios"
              ? status
                ? "line.3.horizontal.decrease.circle.fill"
                : "line.3.horizontal.decrease.circle"
              : undefined
          }
          accessibilityLabel={t("filterStatus")}
          title={t("filterStatus")}
        >
          <Stack.Toolbar.MenuAction
            isOn={status === null}
            onPress={() => setStatus(null)}
          >
            {t("anyStatus")}
          </Stack.Toolbar.MenuAction>
          {STATUSES.map((item) => (
            <Stack.Toolbar.MenuAction
              key={item}
              isOn={status === item}
              onPress={() => setStatus(item)}
            >
              {t(`statusLabel.${item}`)}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          accessibilityLabel={t("new")}
          onPress={() => asMember(() => router.push("/consultation/new"))}
        >
          {t("newShort")}
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
          />
        }
        ListHeaderComponent={
          <View style={styles.filters}>
            <Text tone="secondary">{t("lede")}</Text>
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
            {status ? (
              <Text variant="footnote" tone="secondary">
                {t("filteredBy", { status: t(`statusLabel.${status}`) })}
              </Text>
            ) : null}
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
          // Title first, then where and what, then status and support: the
          // order a resident scans a list of problems in.
          return (
            <Card
              onPress={() => router.push(`/consultation/${item.slug}`)}
              accessibilityLabel={`${item.title}. ${t(`statusLabel.${item.status}`)}. ${t("supports", { count: item.supportCount })}`}
              style={[styles.card, { backgroundColor: colors.surface }]}
              testID={`consultation-${item.slug}`}
            >
              <Text variant="headline" numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.meta}>
                <CategoryBadge
                  icon={item.categoryIcon}
                  color={item.categoryColor}
                  size={20}
                />
                <Text
                  variant="footnote"
                  tone="secondary"
                  style={styles.flex}
                  numberOfLines={1}
                >
                  {item.categoryName} · {item.municipalityName}
                </Text>
              </View>
              <View style={styles.cardBottom}>
                <Badge
                  label={t(`statusLabel.${item.status}`)}
                  tone={style.tone}
                  icon={style.icon}
                />
                {item.publicationStatus === "published" ? null : (
                  <Badge
                    label={ts(`publication.${item.publicationStatus}`)}
                    tone="warning"
                    icon={Clock}
                  />
                )}
                <View style={styles.flex} />
                <View style={styles.support}>
                  <Icon
                    as={ThumbsUp}
                    size={14}
                    color={item.supported ? "text" : "textTertiary"}
                  />
                  <Text
                    variant="footnote"
                    tone={item.supported ? "primary" : "tertiary"}
                    weight="600"
                    tabular
                  >
                    {item.supportCount}
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
  list: { paddingHorizontal: space.md + 4, paddingBottom: space.xl },
  flex: { flex: 1 },
  filters: { gap: space.sm + 4, paddingBottom: space.md, paddingTop: space.xs },
  chips: { gap: space.sm },
  gap: { height: space.sm + 2 },
  skeletons: { gap: space.sm + 2 },
  card: { gap: space.sm },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs + 2 },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: space.sm },
  support: { flexDirection: "row", alignItems: "center", gap: 4 },
});
