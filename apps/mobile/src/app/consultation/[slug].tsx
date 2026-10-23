import Mapbox from "@rnmapbox/maps";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  Landmark,
  MessageSquareText,
  Share2,
  ThumbsUp,
} from "lucide-react-native";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useTranslations } from "use-intl";
import { useMemberAction } from "@/features/auth/session";
import { STATUS_STYLE } from "@/features/consultations/status";
import { orpc } from "@/lib/api";
import { Button } from "@/ui/button";
import { categoryIcon, Icon } from "@/ui/icon";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card, IconButton } from "@/ui/surfaces";
import { Badge } from "@/ui/tags";
import { Text } from "@/ui/text";
import { palettes, radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

export default function ConsultationScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTranslations("consultations");
  const tc = useTranslations("common");
  const format = useFormatter();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <IconButton
              icon={Share2}
              label={tc("share")}
              size={36}
              onPress={() =>
                Share.share({
                  message: `${data.title} — ${data.municipalityName}`,
                })
              }
            />
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={styles.meta}>
          <View
            style={[styles.catIcon, { backgroundColor: data.categoryColor }]}
          >
            <Icon
              as={categoryIcon(data.categoryIcon)}
              size={14}
              color="#FFFFFF"
            />
          </View>
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

        {data.location ? (
          <View style={styles.map}>
            <Mapbox.MapView
              style={StyleSheet.absoluteFill}
              styleURL="mapbox://styles/mapbox/standard"
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              scaleBarEnabled={false}
            >
              <Mapbox.StyleImport
                id="basemap"
                existing
                config={{
                  lightPreset: scheme === "dark" ? "night" : "day",
                  theme: "faded",
                  showPointOfInterestLabels: false,
                  show3dObjects: false,
                }}
              />
              <Mapbox.Camera
                defaultSettings={{
                  centerCoordinate: [data.location.lng, data.location.lat],
                  zoomLevel: 15,
                }}
              />
              <Mapbox.ShapeSource
                id="case-point"
                shape={{
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Point",
                    coordinates: [data.location.lng, data.location.lat],
                  },
                }}
              >
                <Mapbox.CircleLayer
                  id="case-halo"
                  slot="top"
                  style={{
                    circleRadius: 22,
                    circleColor: data.categoryColor,
                    circleOpacity: 0.2,
                  }}
                />
                <Mapbox.CircleLayer
                  id="case-dot"
                  slot="top"
                  style={{
                    circleRadius: 9,
                    circleColor: data.categoryColor,
                    circleStrokeColor: "#FFFFFF",
                    circleStrokeWidth: 3,
                  }}
                />
              </Mapbox.ShapeSource>
            </Mapbox.MapView>
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
                      style={[
                        styles.railDot,
                        { backgroundColor: palettes[scheme].pine },
                      ]}
                    >
                      <Icon as={Landmark} size={13} color="#FFFFFF" />
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

      {!closed ? (
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
  map: {
    height: 180,
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
