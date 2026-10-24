import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { Stamp } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";
import { orpc } from "@/lib/api";
import { Icon } from "@/ui/icon";
import { EmptyState } from "@/ui/states";
import { Card } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import { space, useTheme } from "@/ui/theme";

/** The places you have visited and stamped, in your private passport. */
export default function PassportScreen() {
  const t = useTranslations("account");
  const format = useFormatter();
  const { colors } = useTheme();
  const passport = useQuery(
    orpc.passport.list.queryOptions({ input: { limit: 50 } }),
  );

  return (
    <>
      <Stack.Screen
        options={{ title: t("passport"), headerLargeTitleEnabled: false }}
      />
      <FlashList
        data={passport.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.grouped }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text tone="secondary" style={styles.lede}>
            {t("passportLede", { count: passport.data?.total ?? 0 })}
          </Text>
        }
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          passport.isPending ? null : (
            <EmptyState
              icon={Stamp}
              title={t("passportEmpty")}
              body={t("passportEmptyBody")}
            />
          )
        }
        renderItem={({ item }) => (
          <Card
            style={[styles.card, { backgroundColor: colors.groupedRow }]}
            onPress={
              item.place
                ? () => router.push(`/place/${item.place?.slug}`)
                : undefined
            }
            accessibilityLabel={item.place?.name ?? t("passportRemoved")}
          >
            <View
              style={[
                styles.stamp,
                { borderColor: item.place?.categoryColor ?? colors.separator },
              ]}
            >
              <Icon
                as={Stamp}
                size={20}
                color={item.place?.categoryColor ?? colors.textTertiary}
              />
            </View>
            <View style={styles.flex}>
              <Text variant="headline">
                {item.place?.name ?? t("passportRemoved")}
              </Text>
              <Text variant="footnote" tone="tertiary">
                {item.place ? `${item.place.municipalityName} · ` : ""}
                {format.dateTime(new Date(item.stampedAt), "long")}
              </Text>
            </View>
          </Card>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.md, paddingBottom: space.xxl },
  lede: { paddingBottom: space.md },
  gap: { height: space.sm },
  flex: { flex: 1, gap: 2 },
  card: { flexDirection: "row", alignItems: "center", gap: space.md - 4 },
  stamp: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});
