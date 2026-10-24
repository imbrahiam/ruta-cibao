import { directionsPosition } from "@ruta/contracts";
import { directionsUrl } from "@ruta/shared/directions";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Navigation } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { basemapProps } from "@/features/map/basemap";
import { regionAt } from "@/features/map/geometry";
import { useLocationPermission } from "@/features/map/use-location-permission";
import { orpc } from "@/lib/api";
import { Button } from "@/ui/button";
import { Segmented } from "@/ui/segmented";
import { Skeleton } from "@/ui/states";
import { Text } from "@/ui/text";
import { floating, radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

type Position = { lat: number; lng: number };
type LocationState = "loading" | "denied" | "error" | "ready";

export default function DirectionsScreen() {
  const params = useLocalSearchParams<{
    lat: string;
    lng: string;
    name: string;
  }>();
  const t = useTranslations("directions");
  const { colors, scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const map = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const [mode, setMode] = useState<"drive" | "walk">("drive");
  const [origin, setOrigin] = useState<Position | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("loading");
  const { granted, request } = useLocationPermission();
  const destination = useMemo(
    () =>
      directionsPosition.safeParse({
        lat: Number(params.lat),
        lng: Number(params.lng),
      }),
    [params.lat, params.lng],
  );
  const name = params.name || t("destination");
  const mounted = useRef(true);

  const locate = useCallback(async () => {
    setLocationState("loading");
    try {
      if (!(await request())) {
        if (mounted.current) setLocationState("denied");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!mounted.current) return;
      setOrigin({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setLocationState("ready");
    } catch {
      if (mounted.current) setLocationState("error");
    }
  }, [request]);

  useEffect(() => {
    mounted.current = true;
    if (destination.success) void locate();
    return () => {
      mounted.current = false;
    };
  }, [locate, destination.success]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || locationState !== "denied") return;
      Location.getForegroundPermissionsAsync()
        .then((permission) => {
          if (permission.granted && mounted.current) void locate();
        })
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [locate, locationState]);

  const route = useQuery(
    orpc.directions.compute.queryOptions({
      input: {
        origin: origin ?? { lat: 19.4769, lng: -71.341 },
        destination: destination.success
          ? destination.data
          : { lat: 19.4769, lng: -71.341 },
        mode,
      },
      enabled:
        destination.success && origin !== null && locationState === "ready",
      retry: false,
      staleTime: 60_000,
    }),
  );
  const coordinates = useMemo(
    () =>
      route.data?.path.map((point) => ({
        latitude: point.lat,
        longitude: point.lng,
      })) ?? [],
    [route.data],
  );

  useEffect(() => {
    if (!mapReady || cardHeight === 0 || coordinates.length < 2) return;
    map.current?.fitToCoordinates(coordinates, {
      edgePadding: {
        top: insets.top + 72,
        right: space.xl,
        bottom: space.xl,
        left: space.xl,
      },
      animated: false,
    });
  }, [coordinates, mapReady, cardHeight, insets.top]);

  const formatNumber = (value: number, maximumFractionDigits = 0) =>
    new Intl.NumberFormat("es-DO", { maximumFractionDigits }).format(value);
  const distance = (meters: number) =>
    meters >= 1000
      ? t("distanceKilometers", { distance: formatNumber(meters / 1000, 1) })
      : t("distanceMeters", { distance: formatNumber(meters) });
  const minutes = Math.max(
    1,
    Math.ceil((route.data?.durationSeconds ?? 0) / 60),
  );
  const duration =
    minutes >= 60
      ? t("durationHours", {
          hours: formatNumber(Math.floor(minutes / 60)),
          minutes: formatNumber(minutes % 60),
        })
      : t("durationMinutes", { minutes: formatNumber(minutes) });
  const loading =
    destination.success &&
    (locationState === "loading" ||
      (locationState === "ready" && route.isPending));
  const reason =
    route.error && "data" in route.error
      ? (route.error.data as { reason?: string } | undefined)?.reason
      : undefined;
  const errorMessage = !destination.success
    ? t("invalidDestination")
    : locationState === "error"
      ? t("locationError")
      : route.isError
        ? t(
            reason === "no_route"
              ? "noRoute"
              : reason === "rate_limited"
                ? "rateLimited"
                : "unavailable",
          )
        : null;

  const openMaps = async () => {
    if (!destination.success) return;
    const target = { ...destination.data, label: name };
    try {
      try {
        await Linking.openURL(
          directionsUrl(target, Platform.OS === "ios" ? "ios" : "android"),
        );
      } catch {
        await Linking.openURL(directionsUrl(target, "other"));
      }
    } catch {
      toast.show({ title: t("handoffFailed"), tone: "error" });
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* The system header, transparent over the map, so the close button is
          the platform's own (Liquid Glass on iOS 26). */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          title: "",
          headerShadowVisible: false,
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "xmark" : undefined}
          accessibilityLabel={t("close")}
          onPress={() => router.back()}
        >
          {t("close")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        {...basemapProps(scheme)}
        initialRegion={regionAt(
          destination.success
            ? [destination.data.lng, destination.data.lat]
            : [-71.341, 19.4769],
          11,
          width,
          height,
        )}
        mapPadding={{ top: 0, right: 0, left: 0, bottom: cardHeight }}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={granted}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor={colors.background}
        accessibilityLabel={t("mapLabel")}
      >
        {coordinates.length >= 2 ? (
          <>
            <Polyline
              coordinates={coordinates}
              strokeWidth={9}
              strokeColor={colors.background}
            />
            <Polyline
              coordinates={coordinates}
              strokeWidth={6}
              strokeColor={colors.locate}
            />
          </>
        ) : null}
        {destination.success ? (
          <Marker
            coordinate={{
              latitude: destination.data.lat,
              longitude: destination.data.lng,
            }}
            title={name}
            pinColor={colors.text}
          />
        ) : null}
      </MapView>
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
        <Text variant="title3" accessibilityRole="header" numberOfLines={2}>
          {name}
        </Text>
        {loading ? (
          <View
            style={styles.skeleton}
            accessibilityLabel={t("loading")}
            accessibilityRole="progressbar"
          >
            <Skeleton width="48%" height={42} />
            <Skeleton width="28%" height={20} />
          </View>
        ) : route.data && !errorMessage ? (
          <View accessibilityLiveRegion="polite">
            <Text variant="largeTitle" tabular>
              {duration}
            </Text>
            <Text tone="secondary">{distance(route.data.distanceMeters)}</Text>
          </View>
        ) : null}
        <Segmented
          options={[
            { value: "drive", label: t("drive") },
            { value: "walk", label: t("walk") },
          ]}
          value={mode}
          onChange={setMode}
          accessibilityLabel={t("mode")}
        />
        {locationState === "denied" && destination.success ? (
          <View style={styles.message}>
            <Text variant="headline">{t("permissionTitle")}</Text>
            <Text tone="secondary">{t("permissionBody")}</Text>
            <Button
              label={t("allowLocation")}
              variant="secondary"
              onPress={async () => {
                const permission =
                  await Location.getForegroundPermissionsAsync();
                if (!permission.canAskAgain) await Linking.openSettings();
                else await locate();
              }}
            />
          </View>
        ) : errorMessage ? (
          <Text tone="secondary" accessibilityRole="alert">
            {errorMessage}
          </Text>
        ) : null}
        {destination.success ? (
          <Button
            label={t("openMaps")}
            icon={Navigation}
            variant="secondary"
            block
            onPress={openMaps}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    paddingTop: space.lg,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  skeleton: { gap: space.sm },
  message: { gap: space.sm },
});
