import Mapbox from "@rnmapbox/maps";
import { trafficColor } from "@ruta/shared/traffic";
import { useMemo } from "react";
import { palettes, type Scheme } from "@/ui/theme";
import type { CommunityFeature, TrafficReport } from "./data";

type Selection = { traffic: string | null };

/**
 * What neighbours report on the roads, plus routes and located cases.
 *
 * A reported stretch is drawn on the road itself in its severity colour over a
 * white casing, with a marker carrying the category glyph at its middle, so
 * the colour is never the only signal. Routes are green trails; cases are
 * small discs.
 */
export function CivicLayers({
  scheme,
  traffic,
  community,
  showTraffic,
  showRoutes,
  showConsultations,
  selection,
  onSelectTraffic,
  onSelectCommunity,
}: {
  scheme: Scheme;
  traffic: TrafficReport[];
  community: CommunityFeature[];
  showTraffic: boolean;
  showRoutes: boolean;
  showConsultations: boolean;
  selection: Selection;
  onSelectTraffic: (id: string) => void;
  onSelectCommunity: (feature: CommunityFeature) => void;
}) {
  const colors = palettes[scheme];

  const stretches = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: showTraffic
        ? traffic
            .filter((report) => report.path && report.path.length > 1)
            .map((report) => ({
              type: "Feature",
              id: report.id,
              properties: {
                id: report.id,
                color: trafficColor(report.state, report.severity),
                cleared: report.state === "cleared",
              },
              geometry: {
                type: "LineString",
                coordinates: (report.path ?? []).map((p) => [p.lng, p.lat]),
              },
            }))
        : [],
    }),
    [traffic, showTraffic],
  );

  const markers = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: showTraffic
        ? traffic.map((report) => ({
            type: "Feature",
            id: report.id,
            properties: {
              id: report.id,
              color: trafficColor(report.state, report.severity),
              icon: report.categoryIcon,
              selected: report.id === selection.traffic,
            },
            geometry: { type: "Point", coordinates: [report.lng, report.lat] },
          }))
        : [],
    }),
    [traffic, showTraffic, selection.traffic],
  );

  const routes = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: showRoutes
        ? community
            .filter(
              (item) =>
                item.kind === "route" && item.path && item.path.length > 1,
            )
            .map((item) => ({
              type: "Feature",
              properties: { id: item.id },
              geometry: {
                type: "LineString",
                coordinates: (item.path ?? []).map((p) => [p.lng, p.lat]),
              },
            }))
        : [],
    }),
    [community, showRoutes],
  );

  const cases = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: showConsultations
        ? community
            .filter((item) => item.kind === "consultation")
            .map((item) => ({
              type: "Feature",
              properties: { id: item.id, color: item.color },
              geometry: { type: "Point", coordinates: [item.lng, item.lat] },
            }))
        : [],
    }),
    [community, showConsultations],
  );

  const byId = useMemo(
    () => new Map(community.map((item) => [item.id, item])),
    [community],
  );

  return (
    <>
      <Mapbox.ShapeSource
        id="community-routes"
        shape={routes}
        onPress={(event) => {
          const item = byId.get(String(event.features[0]?.properties?.id));
          if (item) onSelectCommunity(item);
        }}
        hitbox={{ width: 24, height: 24 }}
      >
        <Mapbox.LineLayer
          id="community-route-casing"
          slot="top"
          style={{
            lineColor: "#FFFFFF",
            lineWidth: 7,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
        <Mapbox.LineLayer
          id="community-route-line"
          slot="top"
          style={{
            lineColor: colors.success,
            lineWidth: 4,
            lineDasharray: [1.6, 1.2],
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      </Mapbox.ShapeSource>

      <Mapbox.ShapeSource
        id="community-cases"
        shape={cases}
        onPress={(event) => {
          const item = byId.get(String(event.features[0]?.properties?.id));
          if (item) onSelectCommunity(item);
        }}
      >
        <Mapbox.CircleLayer
          id="community-case-dot"
          slot="top"
          minZoomLevel={10}
          style={{
            circleRadius: ["interpolate", ["linear"], ["zoom"], 10, 5, 15, 9],
            circleColor: ["get", "color"],
            circleStrokeColor: "#FFFFFF",
            circleStrokeWidth: 2,
          }}
        />
      </Mapbox.ShapeSource>

      <Mapbox.ShapeSource
        id="traffic-stretches"
        shape={stretches}
        onPress={(event) => {
          const id = event.features[0]?.properties?.id;
          if (id) onSelectTraffic(String(id));
        }}
        hitbox={{ width: 24, height: 24 }}
      >
        <Mapbox.LineLayer
          id="traffic-stretch-casing"
          slot="top"
          style={{
            lineColor: "#FFFFFF",
            lineWidth: ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 12],
            lineCap: "round",
            lineJoin: "round",
          }}
        />
        <Mapbox.LineLayer
          id="traffic-stretch-line"
          slot="top"
          filter={["!", ["get", "cleared"]]}
          style={{
            lineColor: ["get", "color"],
            lineWidth: ["interpolate", ["linear"], ["zoom"], 10, 2.5, 16, 8],
            lineCap: "round",
            lineJoin: "round",
          }}
        />
        {/* Native line-dasharray takes no data expressions: cleared stretches get their own layer. */}
        <Mapbox.LineLayer
          id="traffic-stretch-line-cleared"
          slot="top"
          filter={["get", "cleared"]}
          style={{
            lineColor: ["get", "color"],
            lineWidth: ["interpolate", ["linear"], ["zoom"], 10, 2.5, 16, 8],
            lineDasharray: [1, 1.5],
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      </Mapbox.ShapeSource>

      <Mapbox.ShapeSource
        id="traffic-markers"
        shape={markers}
        onPress={(event) => {
          const id = event.features[0]?.properties?.id;
          if (id) onSelectTraffic(String(id));
        }}
      >
        <Mapbox.CircleLayer
          id="traffic-marker-halo"
          slot="top"
          filter={["==", ["get", "selected"], true]}
          style={{
            circleRadius: 24,
            circleColor: ["get", "color"],
            circleOpacity: 0.22,
          }}
        />
        <Mapbox.CircleLayer
          id="traffic-marker"
          slot="top"
          style={{
            circleRadius: [
              "interpolate",
              ["linear"],
              ["zoom"],
              8,
              7,
              12,
              12,
              16,
              15,
            ],
            circleColor: ["get", "color"],
            circleStrokeColor: "#FFFFFF",
            circleStrokeWidth: 2.5,
          }}
        />
        <Mapbox.SymbolLayer
          id="traffic-marker-glyph"
          slot="top"
          minZoomLevel={10}
          style={{
            iconImage: ["concat", "glyph-", ["get", "icon"]],
            iconColor: "#FFFFFF",
            iconSize: ["interpolate", ["linear"], ["zoom"], 10, 0.2, 16, 0.3],
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
          }}
        />
      </Mapbox.ShapeSource>
    </>
  );
}
