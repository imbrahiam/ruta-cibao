import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  BedDouble,
  Car,
  ChevronLeft,
  Clock,
  Droplets,
  Footprints,
  Gauge,
  type LucideIcon,
  Navigation,
  ParkingCircle,
  Ruler,
  Toilet,
  UserRound,
  Utensils,
} from "lucide-react-native";
import { useMemo, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { basemapProps } from "@/features/map/basemap";
import { lineCoordinates, regionAt } from "@/features/map/geometry";
import { withOfflineFallback } from "@/features/offline/fallback";
import { SavedCopyNotice } from "@/features/offline/saved-copy-notice";
import { offlineRouteById } from "@/features/offline/store";
import { ContentMenu } from "@/features/safety/content-menu";
import { api, orpc } from "@/lib/api";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card, IconButton } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import { radius, space, useTheme } from "@/ui/theme";

const MAP_HEIGHT = 340;

const SERVICE_ICONS: Record<string, LucideIcon> = {
  water: Droplets,
  food: Utensils,
  lodging: BedDouble,
  guide: UserRound,
  parking: ParkingCircle,
  restrooms: Toilet,
};

export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations("routes");
  const te = useTranslations("explore");
  const tc = useTranslations("common");
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useQuery({
    queryKey: [...orpc.routes.detail.queryOptions({ input: { id } }).queryKey],
    queryFn: withOfflineFallback(
      () => api.routes.detail({ id }),
      () => offlineRouteById(id),
    ),
  });
  const data = route.data;

  const line = useMemo(
    () => (data ? lineCoordinates(data.path) : null),
    [data],
  );
  const map = useRef<MapView>(null);
  const { width } = useWindowDimensions();
  const bounds = line && line.length > 1 ? line : null;

  if (route.isPending) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Skeleton height={340} rounded={0} />
        <View style={styles.body}>
          <Skeleton width="70%" height={28} />
          <Skeleton height={80} rounded={radius.card} />
        </View>
      </View>
    );
  }
  if (!data || !line || !bounds) {
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
          icon={Footprints}
          tone="danger"
          title={t("missing")}
          action={{ label: tc("retry"), onPress: () => route.refetch() }}
        />
      </View>
    );
  }

  const start = data.path[0];
  const hours = Math.floor(data.durationMinutes / 60);
  const minutes = data.durationMinutes % 60;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
      >
        <View style={styles.map}>
          <MapView
            ref={map}
            style={StyleSheet.absoluteFill}
            {...basemapProps(scheme)}
            initialRegion={regionAt(
              [start?.lng ?? 0, start?.lat ?? 0],
              13,
              width,
              MAP_HEIGHT,
            )}
            showsCompass={false}
            showsBuildings={false}
            showsIndoors={false}
            toolbarEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            loadingEnabled
            loadingBackgroundColor={colors.background}
            onMapReady={() =>
              map.current?.fitToCoordinates(bounds, {
                edgePadding: {
                  top: insets.top + 56,
                  bottom: 48,
                  left: 40,
                  right: 40,
                },
                animated: false,
              })
            }
          >
            <Polyline
              coordinates={line}
              strokeColor={colors.background}
              strokeWidth={8}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
            <Polyline
              coordinates={line}
              strokeColor={colors.pin}
              strokeWidth={4.5}
              lineCap="round"
              lineJoin="round"
              zIndex={2}
            />
            {start ? (
              <Marker
                coordinate={{ longitude: start.lng, latitude: start.lat }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                zIndex={3}
                accessibilityLabel={t("toStart")}
              >
                <View
                  style={[
                    styles.startDot,
                    {
                      backgroundColor: colors.pin,
                      borderColor: colors.background,
                    },
                  ]}
                />
              </Marker>
            ) : null}
          </MapView>
        </View>

        <View style={[styles.body, { backgroundColor: colors.background }]}>
          <SavedCopyNotice date={data.savedCopyAt} />
          <View style={styles.title}>
            <Text variant="footnote" tone="accent" weight="600" uppercase>
              {data.categoryName} · {data.municipalityName}
            </Text>
            <Text variant="title1" accessibilityRole="header">
              {data.name}
            </Text>
          </View>

          <View style={styles.stats}>
            <Stat
              icon={Ruler}
              label={t("distance")}
              value={`${(data.distanceMeters / 1000).toFixed(1)} km`}
            />
            <Stat
              icon={Clock}
              label={t("duration")}
              value={te("duration", { hours, minutes }).trim()}
            />
            <Stat
              icon={Gauge}
              label={t("difficulty")}
              value={te(`difficulty.${data.difficulty}`)}
            />
          </View>

          <Text tone="secondary" style={styles.paragraph}>
            {data.description}
          </Text>

          {data.services.length > 0 ? (
            <View style={styles.block}>
              <Text variant="title3" accessibilityRole="header">
                {t("services")}
              </Text>
              <View style={styles.services}>
                {data.services.map((service) => (
                  <View
                    key={service}
                    style={[
                      styles.service,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.hairline,
                      },
                    ]}
                  >
                    <Icon
                      as={SERVICE_ICONS[service] ?? Car}
                      size={16}
                      color="accent"
                    />
                    <Text variant="subhead">{t(`service.${service}`)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Card style={styles.block}>
            <Text variant="headline">{t("safetyTitle")}</Text>
            <Text variant="subhead" tone="secondary">
              {t("safetyBody")}
            </Text>
          </Card>

          {start ? (
            <Button
              label={t("toStart")}
              icon={Navigation}
              block
              onPress={() =>
                router.push({
                  pathname: "/directions",
                  params: {
                    lat: String(start.lat),
                    lng: String(start.lng),
                    name: data.name,
                  },
                })
              }
            />
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm }]}>
        <IconButton
          icon={ChevronLeft}
          label={tc("back")}
          variant="glass"
          onPress={() => router.back()}
          haptic="none"
        />
      </View>
      <View style={[styles.backEnd, { top: insets.top + space.sm }]}>
        <ContentMenu
          target={{ kind: "route", ref: data.id }}
          variant="glass"
          onHidden={() => router.back()}
        />
      </View>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.surface, borderColor: colors.hairline },
      ]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Icon as={icon} size={18} color="accent" />
      <Text variant="headline" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { justifyContent: "center" },
  map: { height: MAP_HEIGHT },
  startDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  body: {
    marginTop: -space.lg,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    gap: space.lg,
  },
  title: { gap: space.xs },
  stats: { flexDirection: "row", gap: space.sm },
  stat: {
    flex: 1,
    gap: 4,
    padding: space.sm + 4,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  paragraph: { lineHeight: 24 },
  block: { gap: space.sm + 2 },
  services: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  service: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.sm + 4,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  back: { position: "absolute", left: space.md },
  backEnd: { position: "absolute", right: space.md },
});
