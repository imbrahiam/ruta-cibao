import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { directionsUrl } from "@ruta/shared/directions";
import * as Location from "expo-location";
import { router, useIsFocused } from "expo-router";
import {
  Layers,
  LocateFixed,
  Navigation,
  Search,
  UserRound,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTranslations } from "use-intl";
import { useMe } from "@/features/auth/session";
import { openTarget } from "@/lib/targets";
import { Button } from "@/ui/button";
import { CategoryBadge } from "@/ui/category-badge";
import { categoryIcon, Icon } from "@/ui/icon";
import { PressableScale } from "@/ui/pressable";
import { EmptyState, Skeleton } from "@/ui/states";
import { IconButton } from "@/ui/surfaces";
import { Chip } from "@/ui/tags";
import { Text } from "@/ui/text";
import { floating, radius, space, spring, useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";
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
  const tc = useTranslations("common");
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
  // Nothing floats over the top of the map any more: only the status bar.
  const topChrome = insets.top + space.md;
  const padding = useMemo(
    () => ({ top: topChrome, bottom: peek + 12, left: 28, right: 28 }),
    [topChrome, peek],
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
      map.current?.flyTo(place.geometry.coordinates as [number, number], 14.5, {
        animated: false,
      });
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

      {/* Map controls, one glass pill above the sheet: what the map shows,
          then where you are. */}
      <View
        pointerEvents="box-none"
        style={[styles.controls, { bottom: peek + space.md }]}
      >
        <View
          style={[
            styles.controlPill,
            floating(scheme),
            { backgroundColor: colors.glass, borderColor: colors.hairline },
          ]}
        >
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
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        animationConfigs={reduced ? { duration: 1 } : spring.sheet}
        backgroundStyle={[
          styles.sheetBackground,
          { backgroundColor: colors.elevated, borderColor: colors.hairline },
        ]}
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
        ) : (
          <BottomSheetFlatList
            data={visible?.features ?? []}
            keyExtractor={(item) => item.properties.id}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: bottomInset + space.lg },
            ]}
            ListHeaderComponent={
              <View style={styles.sheetHeader}>
                <View style={styles.searchRow}>
                  <PressableScale
                    testID="map-search"
                    containerStyle={styles.searchFlex}
                    onPress={() => router.push("/search")}
                    accessibilityRole="search"
                    accessibilityLabel={t("searchLabel")}
                    scaleTo={0.985}
                    style={[styles.search, { backgroundColor: colors.fill }]}
                  >
                    <Icon as={Search} size={19} color="textSecondary" />
                    <Text
                      tone="secondary"
                      numberOfLines={1}
                      style={styles.searchText}
                    >
                      {t("searchPlaceholder")}
                    </Text>
                  </PressableScale>
                  <AccountButton />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                  accessibilityRole="tablist"
                >
                  <Chip
                    label={t("allCategories")}
                    selected={category === null}
                    onPress={() => setCategory(null)}
                  />
                  {places.isPending
                    ? [96, 80, 112].map((width) => (
                        <Skeleton
                          key={width}
                          width={width}
                          height={36}
                          rounded={radius.pill}
                        />
                      ))
                    : categories.map((item) => (
                        <Chip
                          key={item.id}
                          label={item.name}
                          icon={categoryIcon(item.icon)}
                          iconColor={item.color}
                          selected={category === item.id}
                          onPress={() => {
                            setCategory(category === item.id ? null : item.id);
                            setSelected(null);
                          }}
                          testID={`category-${item.id}`}
                        />
                      ))}
                </ScrollView>
                <Text
                  variant="title2"
                  accessibilityRole="header"
                  style={styles.sheetTitle}
                >
                  {t("province")}
                </Text>
                <Text tone="secondary">
                  {places.isPending
                    ? tc("loading")
                    : t("placesCount", {
                        count: visible?.features.length ?? 0,
                      })}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.municipalityChips}
                >
                  <Chip
                    label={tc("allMunicipalities")}
                    selected={municipality === null}
                    onPress={() => {
                      setMunicipality(null);
                      map.current?.showProvince();
                    }}
                  />
                  {municipalities.map((feature) => (
                    <Chip
                      key={feature.properties.id}
                      label={feature.properties.name}
                      selected={municipality === feature.properties.id}
                      onPress={() => {
                        const next =
                          municipality === feature.properties.id
                            ? null
                            : feature.properties.id;
                        setMunicipality(next);
                        const label = feature.properties.label;
                        if (next && label) map.current?.flyTo(label, 11.5);
                        else map.current?.showProvince();
                      }}
                    />
                  ))}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={
              places.isError ? (
                <EmptyState
                  icon={X}
                  tone="danger"
                  title={tc("errorTitle")}
                  body={tc("errorBody")}
                  action={{
                    label: tc("retry"),
                    onPress: () => places.refetch(),
                  }}
                />
              ) : places.isPending ? (
                <View style={styles.skeletons}>
                  {[0, 1, 2, 3].map((row) => (
                    <View key={row} style={styles.skeletonRow}>
                      <Skeleton width={40} height={40} rounded={20} />
                      <View style={styles.skeletonText}>
                        <Skeleton width="70%" height={16} />
                        <Skeleton width="45%" height={12} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyState icon={Search} title={t("emptyFilter")} />
              )
            }
            renderItem={({ item }) => (
              <PlaceRow
                place={item}
                municipalityName={
                  municipalities.find(
                    (m) => m.properties.id === item.properties.municipality,
                  )?.properties.name ?? ""
                }
                onPress={() => select(item)}
              />
            )}
          />
        )}
      </BottomSheet>
    </View>
  );
}

function PlaceRow({
  place,
  municipalityName,
  onPress,
}: {
  place: PlaceFeature;
  municipalityName: string;
  onPress: () => void;
}) {
  const { properties } = place;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${properties.name}, ${properties.categoryName}, ${municipalityName}`}
      style={styles.row}
      testID={`place-row-${properties.slug}`}
    >
      <CategoryBadge
        icon={properties.icon}
        color={properties.color}
        size={40}
      />
      <View style={styles.rowText}>
        <Text variant="body" weight="600" numberOfLines={1}>
          {properties.name}
        </Text>
        <Text variant="footnote" tone="tertiary" numberOfLines={1}>
          {properties.categoryName} · {municipalityName}
        </Text>
      </View>
    </PressableScale>
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
              Linking.openURL(
                directionsUrl(
                  { lat, lng, label: properties.name },
                  Platform.OS === "ios" ? "ios" : "android",
                ),
              ).catch(() =>
                Linking.openURL(
                  directionsUrl({ lat, lng, label: properties.name }, "other"),
                ),
              )
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
/**
 * The way into the account, beside search: initials once signed in, a person
 * glyph otherwise. Saves the tab bar a slot.
 */
function AccountButton() {
  const t = useTranslations("tabs");
  const { colors } = useTheme();
  const { me } = useMe();
  const name = me?.kind === "member" ? (me.displayName ?? "") : "";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("es-DO"))
    .join("");
  return (
    <PressableScale
      onPress={() => router.push("/account")}
      accessibilityRole="button"
      accessibilityLabel={t("account")}
      style={[
        styles.avatar,
        { backgroundColor: initials ? colors.accent : colors.fill },
      ]}
      testID="map-account"
    >
      {initials ? (
        <Text variant="subhead" weight="700" style={{ color: colors.onAccent }}>
          {initials}
        </Text>
      ) : (
        <Icon as={UserRound} size={20} color="textSecondary" />
      )}
    </PressableScale>
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
