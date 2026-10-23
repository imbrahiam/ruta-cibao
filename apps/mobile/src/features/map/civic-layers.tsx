import { trafficColor } from "@ruta/shared/traffic";
import { Marker, Polyline } from "react-native-maps";
import { palettes, type Scheme } from "@/ui/theme";
import type { CommunityFeature, TrafficReport } from "./data";
import { lineCoordinates } from "./geometry";
import { CaseDot, ReportDot } from "./markers";

type Selection = { traffic: string | null };

/**
 * What neighbours report on the roads, plus routes and located cases.
 *
 * A reported stretch is drawn on the road itself in its severity colour over a
 * casing in the map's ground colour, with a marker carrying the category glyph
 * at its middle, so colour is never the only signal. Routes are dashed ink
 * trails; cases are small hollow rings, quieter than places.
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

  return (
    <>
      {showRoutes
        ? community
            .filter(
              (item) =>
                item.kind === "route" && item.path && item.path.length > 1,
            )
            .map((item) => (
              <Polyline
                key={`route-${item.id}`}
                coordinates={lineCoordinates(item.path ?? [])}
                strokeColor={colors.pin}
                strokeWidth={3}
                lineDashPattern={[6, 6]}
                lineCap="round"
                lineJoin="round"
                tappable
                onPress={() => onSelectCommunity(item)}
                zIndex={2}
              />
            ))
        : null}

      {showConsultations
        ? community
            .filter((item) => item.kind === "consultation")
            .map((item) => (
              <Marker
                key={`case-${item.id}-${scheme}`}
                coordinate={{ latitude: item.lat, longitude: item.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={3}
                accessibilityLabel={item.title}
                onPress={() => onSelectCommunity(item)}
              >
                <CaseDot scheme={scheme} />
              </Marker>
            ))
        : null}

      {showTraffic
        ? traffic.map((report) => {
            const color = trafficColor(report.state, report.severity);
            const cleared = report.state === "cleared";
            const selected = report.id === selection.traffic;
            const path =
              report.path && report.path.length > 1
                ? lineCoordinates(report.path)
                : null;
            return [
              path ? (
                <Polyline
                  key={`casing-${report.id}`}
                  coordinates={path}
                  strokeColor={colors.background}
                  strokeWidth={selected ? 11 : 9}
                  lineCap="round"
                  lineJoin="round"
                  zIndex={3}
                />
              ) : null,
              path ? (
                <Polyline
                  key={`stretch-${report.id}`}
                  coordinates={path}
                  strokeColor={color}
                  strokeWidth={selected ? 7 : 5}
                  lineDashPattern={cleared ? [2, 6] : undefined}
                  lineCap="round"
                  lineJoin="round"
                  tappable
                  onPress={() => onSelectTraffic(report.id)}
                  zIndex={4}
                />
              ) : null,
              <Marker
                key={`report-${report.id}-${selected ? "s" : "n"}-${scheme}`}
                coordinate={{ latitude: report.lat, longitude: report.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={selected ? 9 : 7}
                accessibilityLabel={report.categoryName}
                onPress={() => onSelectTraffic(report.id)}
              >
                <ReportDot
                  icon={report.categoryIcon}
                  color={color}
                  selected={selected}
                  scheme={scheme}
                />
              </Marker>,
            ];
          })
        : null}
    </>
  );
}
