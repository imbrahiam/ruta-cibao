import { alertPin, alertSize } from "@/lib/map/marker-pin";
import { STREET_SELECTION } from "@/lib/map/traffic-colors";
import type { CitizenMapProps } from "./types";

export type MapOverlay = {
  id: string;
  color: string;
  label?: string;
  /** A road alert's category glyph. Set only on traffic, which is drawn as
   * a hazard sign rather than a labelled chip — see `overlayChip`. */
  icon?: string;
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
      icon: report.categoryIcon,
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
 * The element a labelled overlay is drawn as, shared by the DOM-marker
 * renderers.
 *
 * A road alert is the hazard diamond (`alertPin`): the category's glyph in its
 * colour, 28 px, centred on the point. It used to be a pill reading "Hoyo en
 * la vía" — 150 px of text that sat over whatever place was on that corner,
 * at every zoom. The glyph says hoyo or bloqueo to someone who does not read
 * the label; the label is still its accessible name and the sheet's title.
 *
 * A route or a case keeps a chip with its name, which is the only way to tell
 * two of them apart. Below street zoom a container class
 * (`map-overlays-compact`, see `globals.css`) shrinks it to a dot.
 */
export function overlayChip(overlay: MapOverlay): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", overlay.label ?? "");
  button.title = overlay.label ?? "";
  if (overlay.icon !== undefined) {
    const { width, height } = alertSize(false);
    const image = document.createElement("img");
    image.src = alertPin(overlay.color, overlay.icon, false);
    image.alt = "";
    image.width = width;
    image.height = height;
    image.draggable = false;
    button.append(image);
    button.className = "map-overlay-alert";
    return button;
  }
  button.textContent = overlay.label ?? "";
  button.className =
    "map-overlay-chip max-w-44 truncate rounded-full border-2 bg-background px-3 py-2 text-xs font-semibold shadow-sm";
  button.style.setProperty("--chip-color", overlay.color);
  return button;
}

/** Below this zoom, overlay chips are drawn as dots. */
export const OVERLAY_COMPACT_CLASS = "map-overlays-compact";
