import { municipalityAt } from "@ruta/shared/boundaries";
import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { LocateFixed, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import MapView from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTranslations } from "use-intl";
import { basemapProps } from "@/features/map/basemap";
import { useBoundaries } from "@/features/map/data";
import { regionAt } from "@/features/map/geometry";
import { setPickedLocation } from "@/features/map/picked-location";
import { useLocationPermission } from "@/features/map/use-location-permission";
import { Button } from "@/ui/button";
import { haptic } from "@/ui/pressable";
import { IconButton } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import { floating, palettes, radius, space, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";

const [WEST, SOUTH, EAST, NORTH] = PROVINCE_BOUNDS;

/**
 * The map moves under a fixed pin: drag until the pin sits on the spot. The
 * pin lifts while the map moves and settles when it stops, and the card says
 * which municipality the point is in as you go.
 */
export default function PickLocationScreen() {
  const params = useLocalSearchParams<{ lng?: string; lat?: string }>();
  const t = useTranslations("picker");
  const tc = useTranslations("common");
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const map = useRef<MapView>(null);
  const { width, height } = useWindowDimensions();
  const boundaries = useBoundaries();
  const initial: [number, number] | null =
    params.lng && params.lat ? [Number(params.lng), Number(params.lat)] : null;
  const [center, setCenter] = useState<[number, number]>(
    initial ?? [(WEST + EAST) / 2, (SOUTH + NORTH) / 2],
  );
  const lift = useSharedValue(0);
  const [cardHeight, setCardHeight] = useState(220);

  const where = municipalityAt(
    { lng: center[0], lat: center[1] },
    boundaries.data,
  );
  const pinStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lift.get() * 10 },
      { scale: 1 + lift.get() * 0.06 },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 - lift.get() * 0.12,
    transform: [{ scale: 1 - lift.get() * 0.3 }],
  }));

  const location = useLocationPermission();
  const locate = async () => {
    if (!(await location.request())) {
      toast.show({ title: t("locationDenied"), tone: "info" });
      return;
    }
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
        initialRegion={regionAt(center, initial ? 16.5 : 10, width, height)}
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
        loadingBackgroundColor={colors.background}
        onPanDrag={() =>
          lift.set(withSpring(1, { duration: 200, dampingRatio: 1 }))
        }
        onRegionChangeComplete={async () => {
          lift.set(withSpring(0, { duration: 350, dampingRatio: 0.6 }));
          // The camera target is the centre of the padded area, which is
          // where the crosshair sits; the region's centre is the whole view's.
          const camera = await map.current?.getCamera();
          if (camera)
            setCenter([camera.center.longitude, camera.center.latitude]);
        }}
      />

      <View
        pointerEvents="none"
        style={[styles.crosshair, { bottom: cardHeight }]}
      >
        <Animated.View style={[styles.groundShadow, shadowStyle]} />
        <Animated.View style={[styles.pin, pinStyle]}>
          <Svg width={40} height={52} viewBox="0 0 48 60">
            <Path
              d="M24 58 C24 58 4 37.5 4 24 A20 20 0 1 1 44 24 C44 37.5 24 58 24 58 Z"
              fill={palettes[scheme].pin}
              stroke={palettes[scheme].background}
              strokeWidth={3}
            />
          </Svg>
          <View
            style={[styles.pinDot, { backgroundColor: palettes[scheme].onPin }]}
          />
        </Animated.View>
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
          label={t("locate")}
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
        <Text variant="footnote" tone="tertiary" uppercase>
          {t("title")}
        </Text>
        <Text variant="title3" accessibilityLiveRegion="polite">
          {where.state === "inside"
            ? where.municipality.name
            : where.state === "outside"
              ? t("outside")
              : t("moveHint")}
        </Text>
        <Text variant="subhead" tone="secondary">
          {where.state === "outside" ? t("outsideBody") : t("hint")}
        </Text>
        <Button
          label={t("confirm")}
          disabled={where.state === "outside"}
          testID="pick-confirm"
          onPress={() => {
            haptic("success");
            setPickedLocation({
              lng: center[0],
              lat: center[1],
              municipalityId:
                where.state === "inside" ? where.municipality.id : null,
              municipalityName:
                where.state === "inside" ? where.municipality.name : null,
            });
            router.back();
          }}
          block
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
  groundShadow: {
    position: "absolute",
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#000",
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
    paddingTop: space.md + 4,
    gap: space.xs + 2,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
  },
});
