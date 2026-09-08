import { STREET_SELECTION } from "@/lib/map/traffic-colors";
import type { CitizenMapProps } from "./types";

export type MapOverlay = {
  id: string;
  color: string;
  label?: string;
  point?: { lng: number; lat: number };
  path?: { lng: number; lat: number }[];
  select?: () => void;
};
export function mapOverlays(
  props: Pick<
    CitizenMapProps,
    | "trafficReports"
    | "communityFeatures"
    | "draftPath"
    | "hoverPath"
    | "onSelectTraffic"
    | "onSelectCommunity"
  >,
): MapOverlay[] {
  const overlays: MapOverlay[] = (props.communityFeatures ?? []).map(
    (feature) => ({
      id: `${feature.kind}-${feature.id}`,
      color: feature.color,
      label: feature.title,
      point: feature,
      path: feature.path ?? undefined,
      select: () => props.onSelectCommunity?.(feature),
    }),
  );
  for (const report of props.trafficReports ?? [])
    overlays.push({
      id: `traffic-${report.id}`,
      color: report.state === "cleared" ? "#15803d" : report.categoryColor,
      label: report.state === "active" ? report.categoryName : undefined,
      point:
        report.state === "active"
          ? { lng: report.lng, lat: report.lat }
          : undefined,
      path: report.path ?? undefined,
      select: () => props.onSelectTraffic?.(report.id),
    });
  if (props.draftPath?.length)
    overlays.push({
      id: "draft",
      path: props.draftPath,
      color: STREET_SELECTION.stroke,
    });
  if (props.hoverPath?.length)
    overlays.push({
      id: "hover",
      path: props.hoverPath,
      color: STREET_SELECTION.hover,
    });
  return overlays;
}
