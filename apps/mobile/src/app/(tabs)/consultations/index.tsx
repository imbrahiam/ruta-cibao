import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { MessageSquareText, Plus, ThumbsUp } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useMemberAction } from "@/features/auth/session";
import {
  type ConsultationStatus,
  STATUS_STYLE,
  STATUSES,
} from "@/features/consultations/status";
import { useAgo } from "@/i18n/ago";
import { orpc } from "@/lib/api";
import { categoryIcon, Icon } from "@/ui/icon";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card, IconButton } from "@/ui/surfaces";
import { Badge, Chip } from "@/ui/tags";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";

export default function ConsultationsScreen() {
  const t = useTranslations("consultations");
  const tc = useTranslations("common");
  const ago = useAgo();
  const { colors } = useTheme();
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

  return (
    <>
      <Stack.Screen
        options={{
          title: t("title"),
          headerRight: () => (
            <IconButton
              icon={Plus}
              label={t("new")}
              variant="filled"
              size={36}
              testID="consultation-new"
              onPress={() => asMember(() => router.push("/consultation/new"))}
            />
          ),
        }}
      />
      <FlashList
        data={list.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching}
            onRefresh={() => list.refetch()}
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
              action={{ label: tc("retry"), onPress: () => list.refetch() }}
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
                <View
                  style={[
                    styles.catIcon,
                    { backgroundColor: item.categoryColor },
                  ]}
                >
                  <Icon
                    as={categoryIcon(item.categoryIcon)}
                    size={14}
                    color="#FFFFFF"
                  />
                </View>
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
