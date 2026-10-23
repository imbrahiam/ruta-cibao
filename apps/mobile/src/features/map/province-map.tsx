import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import MapView, { Marker, Polygon, type Region } from "react-native-maps";
import Supercluster from "supercluster";
import { mapPalettes, palettes, type Scheme } from "@/ui/theme";
import { basemapProps } from "./basemap";
import type { Boundaries, PlaceCollection, PlaceFeature } from "./data";
import {
  boundsRegion,
  polygonRings,
  regionAt,
  regionBounds,
  zoomForRegion,
} from "./geometry";
import { AreaLabel, ClusterBubble, PlaceDot } from "./markers";
import { SelectedPin } from "./selected-pin";

export type Padding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type ProvinceMapHandle = {
  /**
   * `animated: false` jumps instead of easing: for focus arriving from another
   * screen, where a screen transition would cut the ease short. `bottom`
   * overrides the bottom padding when the sheet is about to open taller.
   */
  flyTo: (
    coordinate: [number, number],
    zoom?: number,
    options?: { animated?: boolean; bottom?: number },
  ) => void;
  showProvince: () => void;
};

export type ProvinceMapProps = {
  scheme: Scheme;
  places: PlaceCollection | undefined;
  boundaries: Boundaries | undefined;
  selectedId: string | null;
  showUserLocation: boolean;
  basemap: "standard" | "satellite";
  padding: Padding;
  onSelectPlace: (place: PlaceFeature | null) => void;
  /** Civic overlays (traffic, routes, cases), drawn under the place pins. */
  children?: ReactNode;
};

const [WEST, SOUTH, EAST, NORTH] = PROVINCE_BOUNDS;
const PROVINCE_CORNERS = [
  { latitude: NORTH, longitude: WEST },
  { latitude: SOUTH, longitude: EAST },
];
/**
 * Places gather into clusters up to this zoom: a town centre has dozens of
 * places within a few blocks, and every pin at once is noise, not a map.
 */
const CLUSTER_MAX_ZOOM = 15;
/** From this zoom a place's name sits beside its disc… */
const NAME_ZOOM = 16;
/** …and only while few enough are on screen to read them. */
const MAX_NAMED = 24;
/** Municipality names only while the whole province is in view. */
const AREA_LABEL_MAX_ZOOM = 11.5;

type ClusterProps = { cluster: true; cluster_id: number; point_count: number };

/**
 * The province on Google Maps, styled monochrome: Google's own points of
 * interest and transit hidden (the places here are the curated ones), the
 * province outlined and the country around it dimmed. Places cluster at
 * province scale with supercluster, recomputed only when the camera settles.
 */
export const ProvinceMap = forwardRef<ProvinceMapHandle, ProvinceMapProps>(
  function ProvinceMap(
    {
      scheme,
      places,
      boundaries,
      selectedId,
      showUserLocation,
      basemap,
      padding,
      onSelectPlace,
      children,
    },
    ref,
  ) {
    const map = useRef<MapView>(null);
    const { width, height } = useWindowDimensions();
    const colors = palettes[scheme];
    const [region, setRegion] = useState<Region>(() =>
      boundsRegion(PROVINCE_BOUNDS),
    );
    const [bottomOverride, setBottomOverride] = useState<number | null>(null);

    /**
     * A camera move asked for before the map is ready (a share link opening
     * the app cold, a report focused from another tab) would be lost to the
     * initial framing. Hold the latest one and play it once ready.
     */
    const ready = useRef(false);
    const pending = useRef<(() => void) | null>(null);
    const whenReady = useCallback((move: () => void) => {
      if (ready.current) move();
      else pending.current = move;
    }, []);

    const showProvince = useCallback(
      (animated = true) =>
        map.current?.fitToCoordinates(PROVINCE_CORNERS, {
          edgePadding: { top: 24, bottom: 24, left: 24, right: 24 },
          animated,
        }),
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        flyTo: (coordinate, zoom = 16, { animated = true, bottom } = {}) =>
          whenReady(() => {
            // The padding moves first so the centre lands above the sheet
            // height it is about to have, not the one it has now.
            setBottomOverride(bottom ?? null);
            const inner = height - padding.top - (bottom ?? padding.bottom);
            requestAnimationFrame(() =>
              map.current?.animateToRegion(
                regionAt(coordinate, zoom, width, inner),
                animated ? 600 : 0,
              ),
            );
          }),
        showProvince: () => whenReady(() => showProvince()),
      }),
      [whenReady, showProvince, width, height, padding],
    );

    const index = useMemo(() => {
      const cluster = new Supercluster<PlaceFeature["properties"]>({
        radius: 48,
        maxZoom: CLUSTER_MAX_ZOOM,
      });
      cluster.load((places?.features ?? []) as never);
      return cluster;
    }, [places]);

    const zoom = zoomForRegion(region, width);
    const visible = useMemo(
      () => index.getClusters(regionBounds(region), Math.floor(zoom)),
      [index, region, zoom],
    );

    const selected = useMemo(
      () =>
        places?.features.find(
          (feature) => feature.properties.id === selectedId,
        ) ?? null,
      [places, selectedId],
    );

    const outside = useMemo(
      () => (boundaries?.outside ? polygonRings(boundaries.outside) : []),
      [boundaries],
    );
    const province = useMemo(
      () => (boundaries?.province ? polygonRings(boundaries.province) : []),
      [boundaries],
    );
    const municipalities = useMemo(
      () =>
        (boundaries?.features ?? []).flatMap((feature) =>
          polygonRings(feature.geometry).map((rings, part) => ({
            key: `${feature.properties.id}-${part}`,
            rings,
          })),
        ),
      [boundaries],
    );

    const showNames =
      zoom >= NAME_ZOOM &&
      visible.filter((feature) => !("cluster" in feature.properties)).length <=
        MAX_NAMED;

    return (
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        {...basemapProps(scheme, basemap)}
        initialRegion={boundsRegion(PROVINCE_BOUNDS)}
        mapPadding={{
          top: padding.top,
          bottom: bottomOverride ?? padding.bottom,
          left: 0,
          right: 0,
        }}
        minZoomLevel={7}
        maxZoomLevel={19}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        showsBuildings={false}
        showsIndoors={false}
        showsTraffic={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        moveOnMarkerPress={false}
        loadingEnabled
        loadingBackgroundColor={colors.background}
        loadingIndicatorColor={colors.textTertiary}
        onMapReady={() => {
          ready.current = true;
          map.current?.setMapBoundaries(
            { latitude: NORTH + 0.5, longitude: EAST + 0.6 },
            { latitude: SOUTH - 0.5, longitude: WEST - 0.6 },
          );
          if (pending.current) {
            pending.current();
            pending.current = null;
          } else {
            showProvince(false);
          }
        }}
        onRegionChangeComplete={setRegion}
        onPress={(event) => {
          if (event.nativeEvent.action === "marker-press") return;
          onSelectPlace(null);
        }}
      >
        {outside.map((rings, part) => (
          <Polygon
            // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed geometry
            key={`outside-${part}`}
            coordinates={rings.coordinates}
            holes={rings.holes}
            fillColor={mapPalettes[scheme].veil}
            // MapKit ignores a zero width and strokes in black by default.
            strokeColor="transparent"
            strokeWidth={0}
            tappable={false}
          />
        ))}

        {municipalities.map(({ key, rings }) => (
          <Polygon
            key={key}
            coordinates={rings.coordinates}
            holes={rings.holes}
            fillColor="transparent"
            strokeColor={colors.textTertiary}
            strokeWidth={1}
            lineDashPattern={[4, 4]}
            tappable={false}
          />
        ))}

        {province.map((rings, part) => (
          <Polygon
            // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed geometry
            key={`province-${part}`}
            coordinates={rings.coordinates}
            fillColor="transparent"
            strokeColor={colors.text}
            strokeWidth={2}
            tappable={false}
          />
        ))}

        {zoom < AREA_LABEL_MAX_ZOOM
          ? (boundaries?.features ?? []).map((feature) =>
              feature.properties.label ? (
                <Marker
                  key={`area-${feature.properties.id}-${scheme}`}
                  coordinate={{
                    longitude: feature.properties.label[0],
                    latitude: feature.properties.label[1],
                  }}
                  tracksViewChanges={false}
                  tappable={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={1}
                >
                  <AreaLabel name={feature.properties.name} scheme={scheme} />
                </Marker>
              ) : null,
            )
          : null}

        {children}

        {visible.map((feature) => {
          const [longitude, latitude] = feature.geometry.coordinates as [
            number,
            number,
          ];
          const properties = feature.properties as
            | PlaceFeature["properties"]
            | ClusterProps;
          if ("cluster" in properties && properties.cluster) {
            return (
              <Marker
                key={`cluster-${properties.cluster_id}-${scheme}`}
                coordinate={{ latitude, longitude }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                // Above report dots (7): a town's cluster and a report in the
                // same town share a spot at province scale, and a count hidden
                // under a dot reads as a broken map. Zooming in parts them.
                zIndex={8}
                accessibilityLabel={String(properties.point_count)}
                onPress={() => {
                  const next = Math.min(
                    index.getClusterExpansionZoom(properties.cluster_id) + 0.5,
                    CLUSTER_MAX_ZOOM + 1.5,
                  );
                  // Both basemaps fit a region inside the map padding, so it
                  // is sized for the uncovered part of the screen.
                  map.current?.animateToRegion(
                    regionAt(
                      [longitude, latitude],
                      next,
                      width,
                      height - padding.top - (bottomOverride ?? padding.bottom),
                    ),
                    450,
                  );
                }}
              >
                <ClusterBubble count={properties.point_count} scheme={scheme} />
              </Marker>
            );
          }
          const place = properties as PlaceFeature["properties"];
          if (place.id === selectedId) return null;
          return (
            <Marker
              key={`place-${place.id}-${showNames ? "n" : "d"}-${scheme}`}
              coordinate={{ latitude, longitude }}
              tracksViewChanges={false}
              // The disc's centre sits on the spot even when a name hangs right.
              anchor={showNames ? { x: 13 / 180, y: 0.5 } : { x: 0.5, y: 0.5 }}
              zIndex={6}
              accessibilityLabel={place.name}
              onPress={() => onSelectPlace(feature as unknown as PlaceFeature)}
            >
              <PlaceDot
                icon={place.icon}
                name={showNames ? place.name : undefined}
                scheme={scheme}
              />
            </Marker>
          );
        })}

        {selected ? (
          <Marker
            key={`selected-${selected.properties.id}-${scheme}`}
            coordinate={{
              longitude: selected.geometry.coordinates[0] ?? 0,
              latitude: selected.geometry.coordinates[1] ?? 0,
            }}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={10}
            accessibilityLabel={selected.properties.name}
          >
            <SelectedPin
              icon={selected.properties.icon}
              label={selected.properties.name}
            />
          </Marker>
        ) : null}
      </MapView>
    );
  },
);
