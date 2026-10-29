import { isDefinedError } from "@orpc/client";
import { reportTrafficInput } from "@ruta/contracts";
import { municipalityAt } from "@ruta/shared/boundaries";
import { STREET_EXTENTS, type StreetExtent } from "@ruta/shared/road-geometry";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router } from "expo-router";
import { LocateFixed, X } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTranslations } from "use-intl";
import { useMe } from "@/features/auth/session";
import { basemapProps } from "@/features/map/basemap";
import { useBoundaries } from "@/features/map/data";
import { lineCoordinates, regionAt } from "@/features/map/geometry";
import { useLocationPermission } from "@/features/map/use-location-permission";
import { askForPushAfterContribution } from "@/features/notifications/push";
import {
  isNetworkError,
  withOfflineFallback,
} from "@/features/offline/fallback";
import { enqueueOutbox } from "@/features/offline/outbox";
import { SavedCopyNotice } from "@/features/offline/saved-copy-notice";
import {
  offlineStreetAt,
  offlineTrafficCategories,
} from "@/features/offline/traffic";
import { api, orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { categoryIcon } from "@/ui/icon";
import { haptic } from "@/ui/pressable";
import { Segmented } from "@/ui/segmented";
import { IconButton } from "@/ui/surfaces";
import { Chip } from "@/ui/tags";
import { Text } from "@/ui/text";
import { floating, palettes, radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const SABANETA: [number, number] = [-71.3435, 19.4747];

/**
 * Report what is happening on a road, where you are looking at it: the map
 * moves under a fixed pin, and in street mode the stretch it will cover is
 * drawn as you go, snapped to the real road.
 */
export default function ReportTrafficScreen() {
  const t = useTranslations("contribute");
  const tc = useTranslations("common");
  const to = useTranslations("offline");
  const { me } = useMe();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const id = useMemo(() => requestId(), []);
  const boundaries = useBoundaries();
  const categories = useQuery({
    queryKey: [...orpc.traffic.categories.queryOptions().queryKey],
    queryFn: withOfflineFallback(
      () => api.traffic.categories(),
      offlineTrafficCategories,
    ),
  });
  const [category, setCategory] = useState<string | null>(null);
  const [shape, setShape] = useState<"street" | "point">("street");
  const [extent, setExtent] = useState<StreetExtent>(500);
  const [center, setCenter] = useState<[number, number]>(SABANETA);
  const [description, setDescription] = useState("");
  const map = useRef<MapView>(null);
  const { width, height } = useWindowDimensions();
  const [cardHeight, setCardHeight] = useState(420);

  const streetInput = {
    lng: center[0],
    lat: center[1],
    extentMeters: extent,
  };
  const street = useQuery({
    queryKey: [
      ...orpc.traffic.streetAt.queryOptions({ input: streetInput }).queryKey,
    ],
    queryFn: withOfflineFallback(
      () => api.traffic.streetAt(streetInput),
      () => offlineStreetAt(streetInput),
    ),
    enabled: shape === "street",
  });
  const where = municipalityAt(
    { lng: center[0], lat: center[1] },
    boundaries.data,
  );

  const report = useMutation(
    orpc.traffic.report.mutationOptions({
      onSuccess: () => {
        haptic("success");
        queryClient.invalidateQueries({ queryKey: orpc.traffic.active.key() });
        queryClient.invalidateQueries({
          queryKey: orpc.places.contributions.key(),
        });
        toast.show({ title: t("traffic.sent"), body: t("traffic.sentBody") });
        void askForPushAfterContribution();
        router.back();
      },
      onError: async (error, input) => {
        if (isNetworkError(error) && me?.kind === "member" && me.userId) {
          try {
            await enqueueOutbox({
              userId: me.userId,
              procedure: "traffic.report",
              input: reportTrafficInput.parse(input),
              title: selected?.name,
            });
            toast.show({
              title: to("queuedToast"),
              body: to("queuedToastBody"),
            });
            router.back();
            return;
          } catch {
            // expected: a failed local save keeps the observation intact.
          }
        }
        if (isDefinedError(error) && error.code === "DUPLICATE_REPORT") {
          toast.show({
            title: t("traffic.duplicate"),
            body: t("traffic.duplicateBody"),
            tone: "info",
          });
          return;
        }
        toast.show({
          title: tc("errorTitle"),
          body: tc("errorBody"),
          tone: "error",
        });
      },
    }),
  );

  const path = street.data?.street?.path;
  const line = useMemo(
    () =>
      shape === "street" && path && path.length > 1
        ? lineCoordinates(path)
        : null,
    [path, shape],
  );
  const selected = categories.data?.find((item) => item.id === category);
  const canSend = Boolean(category) && where.state !== "outside";

  const location = useLocationPermission();
  const locate = async () => {
    if (!(await location.request())) return;
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    map.current?.animateToRegion(
      regionAt(
        [position.coords.longitude, position.coords.latitude],
        16.5,
        width,
        height,
      ),
      600,
    );
  };

  return (
    <View style={styles.screen}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        {...basemapProps(scheme)}
        initialRegion={regionAt(SABANETA, 15.5, width, height)}
        mapPadding={{ top: 0, bottom: cardHeight, left: 0, right: 0 }}
        showsUserLocation={location.granted}
        showsMyLocationButton={false}
        showsCompass={false}
        showsBuildings={false}
        showsIndoors={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        loadingEnabled
        loadingBackgroundColor={palettes[scheme].background}
        onRegionChangeComplete={async () => {
          // The camera target is the padded centre, under the crosshair.
          const camera = await map.current?.getCamera();
          if (camera)
            setCenter([camera.center.longitude, camera.center.latitude]);
        }}
      >
        {line ? (
          <Polyline
            coordinates={line}
            strokeColor={palettes[scheme].background}
            strokeWidth={11}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
        ) : null}
        {line ? (
          <Polyline
            coordinates={line}
            strokeColor={selected?.color ?? palettes[scheme].warning}
            strokeWidth={7}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        ) : null}
      </MapView>

      <View
        pointerEvents="none"
        style={[styles.crosshair, { bottom: cardHeight }]}
      >
        <View style={styles.pin}>
          <Svg width={40} height={52} viewBox="0 0 48 60">
            <Path
              d="M24 58 C24 58 4 37.5 4 24 A20 20 0 1 1 44 24 C44 37.5 24 58 24 58 Z"
              fill={selected?.color ?? palettes[scheme].warning}
              stroke={palettes[scheme].onStatus}
              strokeWidth={3}
            />
          </Svg>
          <View
            style={[
              styles.pinDot,
              { backgroundColor: palettes[scheme].onStatus },
            ]}
          />
        </View>
      </View>

      <View style={[styles.top, { top: insets.top + space.sm }]}>
        <IconButton
          icon={X}
          label={tc("close")}
          variant="glass"
          onPress={() => router.back()}
          haptic="none"
        />
        <IconButton
          icon={LocateFixed}
          label={t("traffic.locate")}
          variant="glass"
          onPress={locate}
        />
      </View>

      <View
        onLayout={(event) =>
          setCardHeight(Math.round(event.nativeEvent.layout.height))
        }
        style={[
          styles.card,
          floating(scheme),
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + space.md,
          },
        ]}
      >
        <Text variant="title3" accessibilityRole="header">
          {t("traffic.title")}
        </Text>
        <SavedCopyNotice
          date={
            categories.data?.savedCopyAt ??
            (shape === "street" ? street.data?.savedCopyAt : undefined) ??
            boundaries.data?.savedCopyAt
          }
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {(categories.data ?? []).map((item) => (
            <Chip
              key={item.id}
              label={item.name}
              icon={categoryIcon(item.icon)}
              iconColor={item.color}
              selected={category === item.id}
              onPress={() => setCategory(item.id)}
              testID={`traffic-category-${item.id}`}
            />
          ))}
        </ScrollView>
        <Segmented
          accessibilityLabel={t("traffic.shape")}
          value={shape}
          onChange={setShape}
          options={[
            { value: "street", label: t("traffic.street") },
            { value: "point", label: t("traffic.point") },
          ]}
        />
        {shape === "street" ? (
          <View style={styles.row}>
            {STREET_EXTENTS.map((value) => (
              <Chip
                key={value}
                label={value < 1000 ? `${value} m` : `${value / 1000} km`}
                selected={extent === value}
                onPress={() => setExtent(value)}
              />
            ))}
          </View>
        ) : null}
        <Text
          variant="subhead"
          tone={where.state === "outside" ? "danger" : "secondary"}
          accessibilityLiveRegion="polite"
        >
          {where.state === "outside"
            ? t("traffic.outside")
            : shape === "street"
              ? street.data?.street
                ? t("traffic.onStreet", {
                    street: street.data.street.name ?? t("traffic.unnamed"),
                    place:
                      where.state === "inside" ? where.municipality.name : "",
                  })
                : t("traffic.noStreet")
              : t("traffic.atPoint", {
                  place:
                    where.state === "inside" ? where.municipality.name : "",
                })}
        </Text>
        <Field
          label={t("traffic.description")}
          helper={tc("optional")}
          value={description}
          onChangeText={setDescription}
          maxLength={280}
        />
        <Button
          label={t("traffic.submit")}
          disabled={!canSend}
          loading={report.isPending}
          block
          testID="traffic-submit"
          onPress={() =>
            category &&
            report.mutate({
              requestId: id,
              categoryId: category,
              location: { lng: center[0], lat: center[1] },
              shape:
                shape === "street" && street.data?.street ? "street" : "point",
              roadId:
                shape === "street" ? street.data?.street?.roadId : undefined,
              extentMeters: extent,
              observedAt: new Date().toISOString(),
              description: description.trim() || undefined,
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: {
    position: "absolute",
    left: space.md,
    right: space.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  crosshair: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: { marginBottom: 52, alignItems: "center" },
  pinDot: {
    position: "absolute",
    top: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: space.md + 4,
    gap: space.sm + 4,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
  },
  chips: { gap: space.sm },
  row: { flexDirection: "row", gap: space.sm },
});
