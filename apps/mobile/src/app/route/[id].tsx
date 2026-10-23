import Mapbox from "@rnmapbox/maps";
import { directionsUrl } from "@ruta/shared/directions";
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
import { useMemo } from "react";
import { Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { orpc } from "@/lib/api";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { EmptyState, Skeleton } from "@/ui/states";
import { Card, IconButton } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import { palettes, radius, space, useTheme } from "@/ui/theme";

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
  const route = useQuery(orpc.routes.detail.queryOptions({ input: { id } }));
  const data = route.data;

  const line = useMemo<GeoJSON.Feature | null>(
    () =>
      data
        ? {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: data.path.map((point) => [point.lng, point.lat]),
            },
          }
        : null,
    [data],
  );
  const bounds = useMemo(() => {
    if (!data) return null;
    const lngs = data.path.map((p) => p.lng);
    const lats = data.path.map((p) => p.lat);
    return {
      ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
      sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    };
  }, [data]);

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
          <Mapbox.MapView
            style={StyleSheet.absoluteFill}
            styleURL="mapbox://styles/mapbox/standard"
            scaleBarEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            logoPosition={{ bottom: space.xl + 4, left: 12 }}
            attributionPosition={{ bottom: space.xl + 4, right: 12 }}
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
                bounds: {
                  ...bounds,
                  paddingTop: insets.top + 56,
                  paddingBottom: 64,
                  paddingLeft: 40,
                  paddingRight: 40,
                },
              }}
            />
            <Mapbox.ShapeSource id="route" shape={line}>
              <Mapbox.LineLayer
                id="route-casing"
                slot="top"
                style={{
                  lineColor: "#FFFFFF",
                  lineWidth: 8,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              <Mapbox.LineLayer
                id="route-line"
                slot="top"
                style={{
                  lineColor: palettes[scheme].success,
                  lineWidth: 5,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </Mapbox.ShapeSource>
            {start ? (
              <Mapbox.ShapeSource
                id="route-start"
                shape={{
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "Point",
                    coordinates: [start.lng, start.lat],
                  },
                }}
              >
                <Mapbox.CircleLayer
                  id="route-start-dot"
                  slot="top"
                  style={{
                    circleRadius: 8,
                    circleColor: palettes[scheme].success,
                    circleStrokeColor: "#FFFFFF",
                    circleStrokeWidth: 3,
                  }}
                />
              </Mapbox.ShapeSource>
            ) : null}
          </Mapbox.MapView>
        </View>

        <View style={[styles.body, { backgroundColor: colors.background }]}>
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
              onPress={() => {
                const destination = {
                  lat: start.lat,
                  lng: start.lng,
                  label: data.name,
                };
                Linking.openURL(
                  directionsUrl(
                    destination,
                    Platform.OS === "ios" ? "ios" : "android",
                  ),
                ).catch(() =>
                  Linking.openURL(directionsUrl(destination, "other")),
                );
              }}
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
  map: { height: 340 },
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
});
