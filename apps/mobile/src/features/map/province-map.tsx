import Mapbox, { type Camera, type ShapeSource } from "@rnmapbox/maps";
import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { palettes, type Scheme } from "@/ui/theme";
import type {
  Boundaries,
  CategorySummary,
  PlaceCollection,
  PlaceFeature,
} from "./data";
import { PinImages, pinImage } from "./pin-images";

export type Padding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type ProvinceMapHandle = {
  flyTo: (coordinate: [number, number], zoom?: number) => void;
  showProvince: () => void;
};

export type ProvinceMapProps = {
  scheme: Scheme;
  places: PlaceCollection | undefined;
  boundaries: Boundaries | undefined;
  categories: CategorySummary[];
  selectedId: string | null;
  showUserLocation: boolean;
  basemap: "standard" | "satellite";
  padding: Padding;
  onSelectPlace: (place: PlaceFeature | null) => void;
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
      categories,
      selectedId,
      showUserLocation,
      basemap,
      padding,
      onSelectPlace,
    },
    ref,
  ) {
    const camera = useRef<Camera>(null);
    const source = useRef<ShapeSource>(null);
    const colors = palettes[scheme];

    useImperativeHandle(ref, () => ({
      flyTo: (coordinate, zoom = 14.5) =>
        camera.current?.setCamera({
          centerCoordinate: coordinate,
          zoomLevel: zoom,
          animationDuration: 700,
          animationMode: "easeTo",
          padding: {
            paddingTop: padding.top,
            paddingBottom: padding.bottom,
            paddingLeft: padding.left,
            paddingRight: padding.right,
          },
        }),
      showProvince: () =>
        camera.current?.fitBounds(
          [EAST, NORTH],
          [WEST, SOUTH],
          [padding.top, padding.right, padding.bottom, padding.left],
          700,
        ),
    }));

    const selected = useMemo(
      () =>
        places?.features.find(
          (feature) => feature.properties.id === selectedId,
        ) ?? null,
      [places, selectedId],
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

        <PinImages categories={categories} />

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
            id="place-clusters"
            slot="top"
            filter={["has", "point_count"]}
            style={{
              circleColor: colors.accent,
              circleRadius: [
                "step",
                ["get", "point_count"],
                16,
                10,
                20,
                50,
                26,
              ],
              circleStrokeWidth: 3,
              circleStrokeColor: colors.surface,
            }}
          />
          <Mapbox.SymbolLayer
            id="place-cluster-count"
            slot="top"
            filter={["has", "point_count"]}
            style={{
              textField: ["get", "point_count_abbreviated"],
              textSize: 13,
              textFont: ["DIN Pro Bold", "Arial Unicode MS Bold"],
              textColor: colors.onAccent,
              textAllowOverlap: true,
            }}
          />
          <Mapbox.SymbolLayer
            id="place-pins"
            slot="top"
            filter={["!", ["has", "point_count"]]}
            style={{
              iconImage: ["concat", "pin-", ["get", "category"]],
              iconSize: [
                "interpolate",
                ["linear"],
                ["zoom"],
                8,
                0.6,
                12,
                0.85,
                15,
                1,
              ],
              iconAllowOverlap: true,
              textField: ["step", ["zoom"], "", 13.5, ["get", "name"]],
              textSize: 12,
              textFont: ["DIN Pro Medium", "Arial Unicode MS Regular"],
              textAnchor: "left",
              textOffset: [1.3, 0],
              textMaxWidth: 9,
              textOptional: true,
              textColor: colors.text,
              textHaloColor: colors.background,
              textHaloWidth: 1.5,
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource id="selected-place" shape={selected ?? EMPTY}>
          <Mapbox.SymbolLayer
            id="selected-place-pin"
            slot="top"
            style={{
              iconImage: selected
                ? pinImage(selected.properties.category, true)
                : "",
              iconAnchor: "bottom",
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
            }}
          />
        </Mapbox.ShapeSource>

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
