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

/**
 * The chip a labelled overlay is drawn as, shared by the DOM-marker renderers.
 *
 * Full width only at street zoom. Further out a container class
 * (`map-overlays-compact`, see `globals.css`) shrinks it to a dot in the
 * report's colour: three "Hoyo en la vía" pills across the province covered
 * the pins and the town names they were meant to sit beside. The label stays
 * as the accessible name, and the dot keeps a thumb-sized tap area.
 */
export function overlayChip(overlay: MapOverlay): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = overlay.label ?? "";
  button.setAttribute("aria-label", overlay.label ?? "");
  button.className =
    "map-overlay-chip max-w-44 truncate rounded-full border-2 bg-background px-3 py-2 text-xs font-semibold shadow-sm";
  button.style.setProperty("--chip-color", overlay.color);
  return button;
}

/** Below this zoom, overlay chips are drawn as dots. */
export const OVERLAY_COMPACT_CLASS = "map-overlays-compact";
