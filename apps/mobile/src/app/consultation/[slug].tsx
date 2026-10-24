import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Clock,
  Landmark,
  MessageSquareText,
  ThumbsUp,
} from "lucide-react-native";
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useTranslations } from "use-intl";
import { useMemberAction } from "@/features/auth/session";
import { STATUS_STYLE } from "@/features/consultations/status";
import { basemapProps } from "@/features/map/basemap";
import { regionAt } from "@/features/map/geometry";
import { ContentMenu } from "@/features/safety/content-menu";
import { orpc } from "@/lib/api";
import { Button } from "@/ui/button";
import { CategoryBadge } from "@/ui/category-badge";
import { Icon } from "@/ui/icon";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card } from "@/ui/surfaces";
import { Badge } from "@/ui/tags";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const MAP_HEIGHT = 180;

export default function ConsultationScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTranslations("consultations");
  const tc = useTranslations("common");
  const ts = useTranslations("safety");
  const tu = useTranslations("safetyUi");
  const format = useFormatter();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const queryClient = useQueryClient();
  const asMember = useMemberAction();
  const detail = useQuery(
    orpc.consultations.detail.queryOptions({ input: { slug } }),
  );
  const data = detail.data;
  const key = orpc.consultations.detail.queryKey({ input: { slug } });

  const support = useMutation(
    orpc.consultations.support.mutationOptions({
      onMutate: async ({ supported }) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData(key);
        if (previous)
          queryClient.setQueryData(key, {
            ...previous,
            supported,
            supportCount: previous.supportCount + (supported ? 1 : -1),
          });
        return { previous };
      },
      onError: (_error, _input, context) => {
        if (context?.previous) queryClient.setQueryData(key, context.previous);
        toast.show({
          title: tc("errorTitle"),
          body: tc("errorBody"),
          tone: "error",
        });
      },
      onSuccess: (result) => {
        toast.show({
          title: result.supported ? t("supportedToast") : t("unsupportedToast"),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.consultations.browse.key(),
        });
      },
    }),
  );

  if (detail.isPending) {
    return (
      <View
        style={[
          styles.screen,
          styles.pad,
          { backgroundColor: colors.background },
        ]}
      >
        <Stack.Screen options={{ title: "" }} />
        <Skeleton width="80%" height={30} />
        <Skeleton height={120} rounded={radius.card} />
      </View>
    );
  }
  if (!data) {
    return (
      <View
        style={[
          styles.screen,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <Stack.Screen options={{ title: "" }} />
        <EmptyState
          icon={MessageSquareText}
          tone="danger"
          title={t("missing")}
          action={{ label: tc("retry"), onPress: () => detail.refetch() }}
        />
      </View>
    );
  }

  const status = STATUS_STYLE[data.status];
  const closed = data.status === "resolved" || data.status === "rejected";
  const published = data.publicationStatus === "published";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "",
        }}
      />
      <Stack.Toolbar placement="right">
        {data.isMine ? null : (
          <Stack.Toolbar.View>
            <ContentMenu
              target={{ kind: "consultation", ref: data.slug }}
              onHidden={() => router.back()}
            />
          </Stack.Toolbar.View>
        )}
        <Stack.Toolbar.Button
          hidden={!published}
          icon={Platform.OS === "ios" ? "square.and.arrow.up" : undefined}
          accessibilityLabel={tc("share")}
          onPress={() =>
            Share.share({ message: `${data.title} — ${data.municipalityName}` })
          }
        >
          {tc("share")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={styles.meta}>
          <CategoryBadge
            icon={data.categoryIcon}
            color={data.categoryColor}
            size={26}
          />
          <Text variant="subhead" tone="secondary" style={styles.flex}>
            {data.categoryName} · {data.municipalityName}
          </Text>
        </View>
        <Text variant="title1" accessibilityRole="header">
          {data.title}
        </Text>
        <View style={styles.row}>
          <Badge
            label={t(`statusLabel.${data.status}`)}
            tone={status.tone}
            icon={status.icon}
          />
          <Text variant="footnote" tone="tertiary">
            {data.openedBy ? t("openedBy", { name: data.openedBy }) : null}
            {data.openedBy ? " · " : null}
            {format.dateTime(new Date(data.createdAt), "long")}
          </Text>
        </View>
        <Text style={styles.body}>{data.body}</Text>
        {published ? null : (
          <Card style={styles.notice} testID="consultation-publication-notice">
            <View style={styles.row}>
              <Badge
                label={
                  data.publicationStatus === "pending"
                    ? tu("pendingCaseTitle")
                    : ts("publication.hidden")
                }
                tone="warning"
                icon={Clock}
              />
            </View>
            <Text variant="subhead" tone="secondary">
              {data.publicationStatus === "pending"
                ? ts("publication.pendingCase")
                : ts("publication.hiddenCase")}
            </Text>
          </Card>
        )}

        {data.location ? (
          <View style={styles.map}>
            <MapView
              style={StyleSheet.absoluteFill}
              {...basemapProps(scheme)}
              initialRegion={regionAt(
                [data.location.lng, data.location.lat],
                15.5,
                width,
                MAP_HEIGHT,
              )}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              showsCompass={false}
              showsBuildings={false}
              toolbarEnabled={false}
              loadingEnabled
              loadingBackgroundColor={colors.background}
            >
              <Marker
                coordinate={{
                  longitude: data.location.lng,
                  latitude: data.location.lat,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View
                  style={[
                    styles.caseDot,
                    {
                      backgroundColor: colors.pin,
                      borderColor: colors.background,
                    },
                  ]}
                />
              </Marker>
            </MapView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="title3" accessibilityRole="header">
            {t("timeline")}
          </Text>
          {data.responses.length === 0 ? (
            <Card>
              <Text variant="subhead" tone="secondary">
                {t("noResponses")}
              </Text>
            </Card>
          ) : (
            data.responses.map((response, index) => {
              const after = STATUS_STYLE[response.statusAfter];
              return (
                <View key={response.id} style={styles.event}>
                  <View style={styles.rail}>
                    <View
                      style={[styles.railDot, { backgroundColor: colors.pin }]}
                    >
                      <Icon as={Landmark} size={13} color={colors.onPin} />
                    </View>
                    {index < data.responses.length - 1 ? (
                      <View
                        style={[
                          styles.railLine,
                          { backgroundColor: colors.separator },
                        ]}
                      />
                    ) : null}
                  </View>
                  <Card style={styles.eventCard}>
                    <View style={styles.row}>
                      <Text variant="subhead" weight="600" style={styles.flex}>
                        {response.author ?? t("municipality")}
                      </Text>
                      <Text variant="footnote" tone="tertiary">
                        {format.dateTime(new Date(response.createdAt), "short")}
                      </Text>
                    </View>
                    <Text>{response.body}</Text>
                    <Badge
                      label={t(`statusLabel.${response.statusAfter}`)}
                      tone={after.tone}
                      icon={after.icon}
                    />
                  </Card>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {!closed && published ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderColor: colors.separator,
              paddingBottom: insets.bottom + space.sm,
            },
          ]}
        >
          <View style={styles.flex}>
            <Text variant="headline" tabular>
              {t("supports", { count: data.supportCount })}
            </Text>
            <Text variant="footnote" tone="tertiary">
              {data.isMine ? t("yourCase") : t("supportHint")}
            </Text>
          </View>
          <Button
            label={data.supported ? t("supported") : t("support")}
            icon={ThumbsUp}
            variant={data.supported ? "secondary" : "primary"}
            size="md"
            testID="consultation-support"
            loading={support.isPending}
            onPress={() =>
              asMember(() =>
                support.mutate({
                  consultationId: data.id,
                  supported: !data.supported,
                }),
              )
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { justifyContent: "center" },
  pad: { padding: space.md, gap: space.md, paddingTop: 120 },
  flex: { flex: 1 },
  notice: { gap: space.sm },
  content: { paddingHorizontal: space.md, gap: space.md },
  meta: { flexDirection: "row", alignItems: "center", gap: space.sm },
  catIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flexWrap: "wrap",
  },
  body: { lineHeight: 25 },
  caseDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  map: {
    height: MAP_HEIGHT,
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  section: { gap: space.sm + 4, paddingTop: space.sm },
  event: { flexDirection: "row", gap: space.sm + 4 },
  rail: { alignItems: "center", width: 26 },
  railDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  railLine: { width: 2, flex: 1, marginTop: 4 },
  eventCard: { flex: 1, gap: space.sm, marginBottom: space.sm },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
