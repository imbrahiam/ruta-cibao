import Mapbox, {
  type Camera,
  type CircleLayerStyle,
  type ShapeSource,
} from "@rnmapbox/maps";
import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import {
  forwardRef,
  type ReactNode,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { StyleSheet } from "react-native";
import { palettes, type Scheme } from "@/ui/theme";
import type { Boundaries, PlaceCollection, PlaceFeature } from "./data";
import { MAP_GLYPHS } from "./glyphs";
import { SelectedPin } from "./selected-pin";

/** Map-ready image ids: every glyph, drawn white and recoloured as an SDF. */
const GLYPH_IMAGES = Object.fromEntries(
  Object.entries(MAP_GLYPHS).map(([name, source]) => [
    `glyph-${name}`,
    { image: source, sdf: true },
  ]),
);

/** A place dot grows with zoom: a speck at province scale, a tappable disc in town. */
function dotRadius(extra: number): CircleLayerStyle["circleRadius"] {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    8,
    5 + extra / 2,
    11,
    9 + extra,
    14,
    13 + extra,
    17,
    15 + extra,
  ];
}

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

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * The province on Mapbox Standard, quietened: no third-party points of interest
 * (the places here are the curated ones), no 3D, Spanish labels. Civic layers
 * sit on top in the style's `top` slot so the basemap never covers them.
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
    const camera = useRef<Camera>(null);
    const source = useRef<ShapeSource>(null);
    const colors = palettes[scheme];

    /**
     * A camera move asked for before the map has loaded (a share link opening
     * the app cold, a report focused from another tab) is lost to the initial
     * `defaultSettings` framing. Hold the latest one and play it on load.
     */
    const loaded = useRef(false);
    const pending = useRef<(() => void) | null>(null);
    const whenLoaded = (move: () => void) => {
      if (loaded.current) move();
      else pending.current = move;
    };

    useImperativeHandle(ref, () => ({
      flyTo: (coordinate, zoom = 14.5, { animated = true, bottom } = {}) =>
        whenLoaded(() =>
          camera.current?.setCamera({
            centerCoordinate: coordinate,
            zoomLevel: zoom,
            animationDuration: animated ? 700 : 0,
            animationMode: animated ? "easeTo" : "moveTo",
            padding: {
              paddingTop: padding.top,
              paddingBottom: bottom ?? padding.bottom,
              paddingLeft: padding.left,
              paddingRight: padding.right,
            },
          }),
        ),
      showProvince: () =>
        whenLoaded(() =>
          camera.current?.fitBounds(
            [EAST, NORTH],
            [WEST, SOUTH],
            [padding.top, padding.right, padding.bottom, padding.left],
            700,
          ),
        ),
    }));

    const selected = useMemo(
      () =>
        places?.features.find(
          (feature) => feature.properties.id === selectedId,
        ) ?? null,
      [places, selectedId],
    );

    /** Single places, minus the selected one (it is drawn as a marker on top). */
    const unclustered = useMemo(
      () =>
        [
          "all",
          ["!", ["has", "point_count"]],
          ["!=", ["get", "id"], selectedId ?? ""],
        ] as const,
      [selectedId],
    );

    const labels = useMemo<GeoJSON.FeatureCollection>(
      () => ({
        type: "FeatureCollection",
        features: (boundaries?.features ?? []).flatMap((feature) =>
          feature.properties.label
            ? [
                {
                  type: "Feature",
                  properties: { name: feature.properties.name },
                  geometry: {
                    type: "Point",
                    coordinates: feature.properties.label,
                  },
                },
              ]
            : [],
        ),
      }),
      [boundaries],
    );

    return (
      <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        styleURL={
          basemap === "satellite"
            ? "mapbox://styles/mapbox/standard-satellite"
            : "mapbox://styles/mapbox/standard"
        }
        projection="mercator"
        localizeLabels={{ locale: "es" }}
        scaleBarEnabled={false}
        compassEnabled
        compassFadeWhenNorth
        compassPosition={{ top: padding.top - 4, right: 16 }}
        logoPosition={{ bottom: padding.bottom + 4, left: 16 }}
        attributionPosition={{ bottom: padding.bottom + 4, right: 16 }}
        pitchEnabled={false}
        onPress={() => onSelectPlace(null)}
        onDidFinishLoadingMap={() => {
          loaded.current = true;
          pending.current?.();
          pending.current = null;
        }}
      >
        <Mapbox.StyleImport
          id="basemap"
          existing
          config={{
            lightPreset: scheme === "dark" ? "night" : "day",
            theme: "faded",
            showPointOfInterestLabels: false,
            showTransitLabels: false,
            show3dObjects: false,
            showPedestrianRoads: false,
          }}
        />

        <Mapbox.Camera
          ref={camera}
          defaultSettings={{
            bounds: {
              ne: [EAST, NORTH],
              sw: [WEST, SOUTH],
              paddingTop: padding.top,
              paddingBottom: padding.bottom,
              paddingLeft: padding.left,
              paddingRight: padding.right,
            },
          }}
          minZoomLevel={7}
          maxZoomLevel={18}
          maxBounds={{
            ne: [EAST + 0.6, NORTH + 0.5],
            sw: [WEST - 0.6, SOUTH - 0.5],
          }}
        />

        <Mapbox.Images images={GLYPH_IMAGES} />

        <Mapbox.ShapeSource
          id="province-outside"
          shape={
            boundaries?.outside
              ? {
                  type: "Feature",
                  properties: {},
                  geometry: boundaries.outside,
                }
              : EMPTY
          }
        >
          <Mapbox.FillLayer
            id="province-outside-veil"
            slot="middle"
            style={{
              fillColor: colors.background,
              fillOpacity: [
                "interpolate",
                ["linear"],
                ["zoom"],
                7,
                0.55,
                12,
                0.25,
              ],
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource
          id="municipalities"
          shape={
            boundaries
              ? { type: "FeatureCollection", features: boundaries.features }
              : EMPTY
          }
        >
          <Mapbox.LineLayer
            id="municipality-lines"
            slot="middle"
            style={{
              lineColor: colors.textTertiary,
              lineWidth: ["interpolate", ["linear"], ["zoom"], 8, 1, 13, 1.6],
              lineDasharray: [2, 2],
              lineOpacity: 0.7,
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource
          id="province-outline"
          shape={
            boundaries?.province
              ? {
                  type: "Feature",
                  properties: {},
                  geometry: boundaries.province,
                }
              : EMPTY
          }
        >
          <Mapbox.LineLayer
            id="province-outline-line"
            slot="middle"
            style={{
              lineColor: colors.accent,
              lineWidth: ["interpolate", ["linear"], ["zoom"], 8, 1.5, 13, 2.5],
              lineOpacity: 0.85,
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource id="municipality-labels" shape={labels}>
          <Mapbox.SymbolLayer
            id="municipality-label"
            slot="top"
            maxZoomLevel={11.5}
            style={{
              textField: ["upcase", ["get", "name"]],
              textSize: 11,
              textLetterSpacing: 0.12,
              textFont: ["DIN Pro Medium", "Arial Unicode MS Regular"],
              textColor: colors.textSecondary,
              textHaloColor: colors.background,
              textHaloWidth: 1.5,
            }}
          />
        </Mapbox.ShapeSource>

        {children}

        <Mapbox.ShapeSource
          ref={source}
          id="places"
          shape={places ?? EMPTY}
          cluster
          clusterRadius={44}
          clusterMaxZoomLevel={12}
          onPress={async (event) => {
            const feature = event.features[0];
            if (!feature) return;
            if (feature.properties?.cluster) {
              const zoom =
                await source.current?.getClusterExpansionZoom(feature);
              const coordinates = (feature.geometry as GeoJSON.Point)
                .coordinates as [number, number];
              camera.current?.setCamera({
                centerCoordinate: coordinates,
                zoomLevel: (zoom ?? 12) + 0.5,
                animationDuration: 500,
              });
              return;
            }
            onSelectPlace(feature as PlaceFeature);
          }}
        >
          <Mapbox.CircleLayer
            id="place-cluster-halo"
            slot="top"
            filter={["has", "point_count"]}
            style={{
              circleColor: colors.accent,
              circleOpacity: 0.18,
              circleRadius: [
                "step",
                ["get", "point_count"],
                24,
                10,
                29,
                50,
                36,
              ],
            }}
          />
          <Mapbox.CircleLayer
            id="place-clusters"
            slot="top"
            filter={["has", "point_count"]}
            style={{
              circleColor: colors.accent,
              circleRadius: [
                "step",
                ["get", "point_count"],
                17,
                10,
                21,
                50,
                27,
              ],
              circleStrokeWidth: 2.5,
              circleStrokeColor: "#FFFFFF",
            }}
          />
          <Mapbox.SymbolLayer
            id="place-cluster-count"
            slot="top"
            filter={["has", "point_count"]}
            style={{
              textField: ["get", "point_count_abbreviated"],
              textSize: 14,
              textFont: ["DIN Pro Bold", "Arial Unicode MS Bold"],
              textColor: "#FFFFFF",
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
          <Mapbox.CircleLayer
            id="place-shadow"
            slot="top"
            filter={unclustered}
            style={{
              circleColor: "#000000",
              circleOpacity: scheme === "dark" ? 0.45 : 0.22,
              circleBlur: 0.7,
              circleTranslate: [0, 2],
              circleRadius: dotRadius(4),
            }}
          />
          <Mapbox.CircleLayer
            id="place-dots"
            slot="top"
            filter={unclustered}
            style={{
              circleColor: ["get", "color"],
              circleRadius: dotRadius(0),
              circleStrokeWidth: [
                "interpolate",
                ["linear"],
                ["zoom"],
                8,
                1.5,
                13,
                2.5,
              ],
              circleStrokeColor: "#FFFFFF",
              circlePitchAlignment: "map",
            }}
          />
          <Mapbox.SymbolLayer
            id="place-glyphs"
            slot="top"
            filter={unclustered}
            minZoomLevel={10.5}
            style={{
              iconImage: ["concat", "glyph-", ["get", "icon"]],
              iconColor: "#FFFFFF",
              iconSize: [
                "interpolate",
                ["linear"],
                ["zoom"],
                10.5,
                0.2,
                13,
                0.27,
                16,
                0.32,
              ],
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              textField: ["step", ["zoom"], "", 13.5, ["get", "name"]],
              textSize: 12.5,
              textFont: ["DIN Pro Medium", "Arial Unicode MS Regular"],
              textAnchor: "left",
              textOffset: [1.45, 0],
              textMaxWidth: 10,
              textOptional: true,
              textColor: colors.text,
              textHaloColor: colors.background,
              textHaloWidth: 1.6,
            }}
          />
        </Mapbox.ShapeSource>

        {selected ? (
          <Mapbox.MarkerView
            key={selected.properties.id}
            coordinate={selected.geometry.coordinates as [number, number]}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
            allowOverlapWithPuck
          >
            <SelectedPin
              color={selected.properties.color}
              icon={selected.properties.icon}
              label={selected.properties.name}
            />
          </Mapbox.MarkerView>
        ) : null}

        {showUserLocation ? (
          <Mapbox.LocationPuck
            puckBearingEnabled
            puckBearing="heading"
            pulsing={{ isEnabled: true }}
          />
        ) : null}
      </Mapbox.MapView>
    );
  },
);
