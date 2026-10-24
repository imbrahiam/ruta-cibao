import BottomSheet from "@gorhom/bottom-sheet";
import * as Location from "expo-location";
import { router, useIsFocused } from "expo-router";
import { Layers, LocateFixed, Navigation, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTranslations } from "use-intl";
import { openTarget } from "@/lib/targets";
import { Button } from "@/ui/button";
import { CategoryBadge } from "@/ui/category-badge";
import { Icon } from "@/ui/icon";
import { PressableScale } from "@/ui/pressable";
import { IconButton } from "@/ui/surfaces";
import { Text } from "@/ui/text";
import { floating, radius, space, spring, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";
import { CategoryFilter } from "./category-filter";
import { CivicLayers } from "./civic-layers";
import {
  categoriesOf,
  type PlaceFeature,
  type TrafficReport,
  useBoundaries,
  useCommunity,
  usePlaceCollection,
  useTraffic,
} from "./data";
import { consumeFocusRequest, useFocusRequest } from "./focus";
import { setMapLayers, useMapLayers } from "./layers";
import { ProvinceMap, type ProvinceMapHandle } from "./province-map";
import { TrafficSummary } from "./traffic-summary";

/** Height of the floating system tab bar the sheet must clear. */
const TAB_BAR = Platform.select({ ios: 56, default: 80 });
/** How much of the sheet shows above the tab bar when resting. */
const PEEK = 132;

export function MapScreen() {
  const t = useTranslations("map");
  const _tc = useTranslations("common");
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const toast = useToast();
  const reduced = useReducedMotion();
  const map = useRef<ProvinceMapHandle>(null);
  const sheet = useRef<BottomSheet>(null);

  const places = usePlaceCollection();
  const boundaries = useBoundaries();
  const categories = useMemo(() => categoriesOf(places.data), [places.data]);
  const layers = useMapLayers();

  const [category, setCategory] = useState<string | null>(null);
  const [municipality, setMunicipality] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlaceFeature | null>(null);
  const [locating, setLocating] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [trafficId, setTrafficId] = useState<string | null>(null);
  const traffic = useTraffic(layers.traffic);
  const community = useCommunity(layers.routes || layers.consultations);
  const selectedTraffic =
    traffic.data?.find((report) => report.id === trafficId) ?? null;

  // Blocking an author removes their places from the collection; a sheet still
  // open on one of them would describe something that is no longer there.
  useEffect(() => {
    if (!selected || !places.data) return;
    const stillThere = places.data.features.some(
      (feature) => feature.properties.id === selected.properties.id,
    );
    if (!stillThere) setSelected(null);
  }, [selected, places.data]);

  const visible = useMemo(() => {
    if (!places.data) return undefined;
    return {
      ...places.data,
      features: places.data.features.filter(
        (feature) =>
          (!category || feature.properties.category === category) &&
          (!municipality || feature.properties.municipality === municipality),
      ),
    };
  }, [places.data, category, municipality]);

  const bottomInset = insets.bottom + TAB_BAR;
  const peek = PEEK + bottomInset;
  const midSheet = Math.round(height * 0.52);
  const snapPoints = useMemo(() => [peek, midSheet, "90%"], [peek, midSheet]);
  // The sheet exists only for something chosen on the map; otherwise the
  // map runs down to the tab bar.
  const sheetOpen = selected !== null || trafficId !== null;
  const bottomEdge = sheetOpen ? peek : bottomInset;
  // Nothing floats over the top of the map any more: only the status bar.
  const topChrome = insets.top + space.md;
  const padding = useMemo(
    () => ({ top: topChrome, bottom: bottomEdge + 12, left: 28, right: 28 }),
    [topChrome, bottomEdge],
  );

  const select = useCallback((place: PlaceFeature | null) => {
    setSelected(place);
    if (place) {
      map.current?.flyTo(place.geometry.coordinates as [number, number]);
      sheet.current?.snapToIndex(0);
    }
  }, []);

  /**
   * A live report someone else filed carries a question for the reader ("is it
   * still there?"), so its sheet opens at the middle detent; the camera keeps
   * the stretch above whichever height the sheet takes.
   */
  const showTraffic = useCallback(
    (report: TrafficReport, animated = true) => {
      const asks = !report.isMine && report.state !== "cleared";
      setSelected(null);
      setTrafficId(report.id);
      map.current?.flyTo([report.lng, report.lat], 15, {
        animated,
        bottom: (asks ? midSheet : peek) + 12,
      });
      sheet.current?.snapToIndex(asks ? 1 : 0);
    },
    [midSheet, peek],
  );

  // Resolved only once this tab is on screen: a camera move sent to a map
  // that is detached (another tab, a link screen still covering it) is lost.
  const focus = useFocusRequest();
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!focus || !isFocused) return;
    if (focus.kind === "place") {
      if (!places.data) return;
      consumeFocusRequest();
      const place = places.data.features.find(
        (feature) => feature.properties.id === focus.id,
      );
      if (!place) return;
      setTrafficId(null);
      setCategory(null);
      setMunicipality(null);
      setSelected(place);
      map.current?.flyTo(
        place.geometry.coordinates as [number, number],
        undefined,
        { animated: false },
      );
      sheet.current?.snapToIndex(0);
      return;
    }
    // A report is a stretch on the traffic layer: show the layer if it was off.
    if (!layers.traffic) {
      setMapLayers({ traffic: true });
      return;
    }
    if (!traffic.data) return;
    consumeFocusRequest();
    const report = traffic.data.find((item) => item.id === focus.id);
    if (!report) {
      toast.show({ title: t("trafficGone"), tone: "info" });
      return;
    }
    showTraffic(report, false);
  }, [
    focus,
    isFocused,
    places.data,
    traffic.data,
    layers.traffic,
    showTraffic,
    toast,
    t,
  ]);

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        toast.show({
          title: t("locationDenied"),
          body: t("locationDeniedBody"),
          tone: "info",
        });
        return;
      }
      setShowUser(true);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      map.current?.flyTo(
        [position.coords.longitude, position.coords.latitude],
        14,
      );
    } catch {
      toast.show({ title: t("locationFailed"), tone: "error" });
    } finally {
      setLocating(false);
    }
  }, [t, toast]);

  const municipalities = boundaries.data?.features ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ProvinceMap
        ref={map}
        scheme={scheme}
        places={layers.places ? visible : undefined}
        boundaries={boundaries.data}
        selectedId={selected?.properties.id ?? null}
        showUserLocation={showUser}
        basemap={layers.basemap}
        padding={padding}
        onSelectPlace={(place) => {
          setTrafficId(null);
          select(place);
        }}
      >
        <CivicLayers
          scheme={scheme}
          traffic={traffic.data ?? []}
          community={community.data?.features ?? []}
          showTraffic={layers.traffic}
          showRoutes={layers.routes}
          showConsultations={layers.consultations}
          selection={{ traffic: trafficId }}
          onSelectTraffic={(id) => {
            const report = traffic.data?.find((item) => item.id === id);
            if (report) showTraffic(report);
          }}
          onSelectCommunity={(feature) => openTarget(feature.href)}
        />
      </ProvinceMap>

      {/* Keeps the clock and battery legible over busy streets and pins. */}
      <Svg
        pointerEvents="none"
        style={[styles.scrim, { height: insets.top + space.lg }]}
        width="100%"
        height={insets.top + space.lg}
      >
        <Defs>
          <LinearGradient id="status-scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0.92} />
            <Stop
              offset="0.6"
              stopColor={colors.background}
              stopOpacity={0.6}
            />
            <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#status-scrim)" />
      </Svg>

      {/* Map controls, one glass pill above the sheet: which places, what
          the map shows, then where you are. */}
      <View
        pointerEvents="box-none"
        style={[styles.controls, { bottom: bottomEdge + space.md }]}
      >
        <View
          style={[
            styles.controlPill,
            floating(scheme),
            { backgroundColor: colors.glass, borderColor: colors.hairline },
          ]}
        >
          <CategoryFilter
            categories={categories}
            value={category}
            onChange={(next) => {
              setCategory(next);
              setSelected(null);
            }}
          />
          <View
            style={[
              styles.controlDivider,
              { backgroundColor: colors.hairline },
            ]}
          />
          <PressableScale
            onPress={() => router.push("/map-layers")}
            accessibilityRole="button"
            accessibilityLabel={t("layers")}
            style={styles.controlButton}
            testID="map-layers"
          >
            <Icon as={Layers} size={20} color="text" />
          </PressableScale>
          <View
            style={[
              styles.controlDivider,
              { backgroundColor: colors.hairline },
            ]}
          />
          <PressableScale
            onPress={locate}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel={t("locate")}
            style={styles.controlButton}
            testID="map-locate"
          >
            <Icon
              as={LocateFixed}
              size={20}
              color={showUser ? colors.locate : colors.text}
            />
          </PressableScale>
        </View>
      </View>

      <BottomSheet
        ref={sheet}
        index={sheetOpen ? 0 : -1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        onClose={() => {
          setSelected(null);
          setTrafficId(null);
        }}
        animationConfigs={reduced ? { duration: 1 } : spring.sheet}
        backgroundStyle={[
          styles.sheetBackground,
          { backgroundColor: colors.elevated, borderColor: colors.hairline },
        ]}
        handleStyle={styles.handle}
        handleIndicatorStyle={{
          backgroundColor: colors.fillPressed,
          width: 40,
        }}
        style={floating(scheme)}
        accessible={false}
      >
        {selectedTraffic ? (
          <TrafficSummary
            report={selectedTraffic}
            onClose={() => setTrafficId(null)}
          />
        ) : selected ? (
          <PlaceSummary
            place={selected}
            municipalityName={
              municipalities.find(
                (m) => m.properties.id === selected.properties.municipality,
              )?.properties.name ?? ""
            }
            onClose={() => setSelected(null)}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

function PlaceSummary({
  place,
  municipalityName,
  onClose,
}: {
  place: PlaceFeature;
  municipalityName: string;
  onClose: () => void;
}) {
  const t = useTranslations("map");
  const tc = useTranslations("common");
  const { properties, geometry } = place;
  const [lng, lat] = geometry.coordinates as [number, number];

  return (
    <View style={styles.summary} testID="place-summary">
      <View style={styles.summaryHeader}>
        <CategoryBadge
          icon={properties.icon}
          color={properties.color}
          size={48}
          inverse
        />
        <View style={styles.rowText}>
          <Text variant="title3" numberOfLines={2} accessibilityRole="header">
            {properties.name}
          </Text>
          <Text variant="subhead" tone="tertiary">
            {properties.categoryName} · {municipalityName}
          </Text>
        </View>
        <IconButton
          icon={X}
          label={tc("close")}
          onPress={onClose}
          size={32}
          haptic="none"
        />
      </View>
      <View style={styles.summaryActions}>
        <View style={styles.flex}>
          <Button
            label={t("directions")}
            icon={Navigation}
            size="md"
            block
            onPress={() =>
              router.push({
                pathname: "/directions",
                params: {
                  lat: String(lat),
                  lng: String(lng),
                  name: properties.name,
                },
              })
            }
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t("details")}
            variant="secondary"
            size="md"
            block
            onPress={() => router.push(`/place/${properties.slug}`)}
          />
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrim: { position: "absolute", left: 0, right: 0, top: 0 },
  flex: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  searchFlex: { flex: 1 },
  search: {
    height: 44,
    borderRadius: radius.pill,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md - 2,
  },
  searchText: { flex: 1 },
  chips: { gap: space.sm, paddingVertical: space.sm + 2 },
  sheetTitle: { marginTop: space.xs },
  controls: { position: "absolute", right: space.md },
  controlPill: {
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  controlButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  controlDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBackground: {
    borderRadius: radius.panel,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  /** The grabber gets room above and below, so it reads as something to pull. */
  handle: { paddingTop: 10, paddingBottom: 8 },
  sheetHeader: { gap: space.xs, paddingBottom: space.md },
  municipalityChips: { gap: space.sm, paddingTop: space.sm + 4 },
  listContent: { paddingHorizontal: space.md, paddingBottom: space.xxl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md - 4,
    paddingVertical: space.sm + 2,
  },
  rowText: { flex: 1, gap: 2 },
  skeletons: { gap: space.md, paddingTop: space.sm },
  skeletonRow: {
    flexDirection: "row",
    gap: space.md - 4,
    alignItems: "center",
  },
  skeletonText: { flex: 1, gap: space.xs + 2 },
  summary: { paddingHorizontal: space.md, gap: space.md, paddingTop: space.xs },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md - 4,
  },
  summaryActions: { flexDirection: "row", gap: space.sm },
});
