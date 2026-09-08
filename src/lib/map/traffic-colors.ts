import type { TrafficSeverity } from "@/db/schema/catalog";
import { mapPalette } from "./palette";

/**
 * What colour a reported road is drawn in.
 *
 * Google's traffic layer colours a road by how fast cars are moving on it. This
 * one colours it by what neighbours have said about it, and the two sit side by
 * side on purpose: the official layer says a road is slow, this one says why —
 * and says it for the rural roads Google has no probe data for at all, which is
 * most of this province.
 *
 * The scale is deliberately the one everybody already knows, and each colour
 * means one thing a driver can act on:
 *
 *   red     do not go this way
 *   amber   passable, slowly
 *   yellow  worth knowing about
 *   green   somebody reported this and neighbours say it is over
 *
 * Green is the one a speed-based layer cannot have, and the most useful thing
 * here: a road that was flooded this morning and is clear now is exactly what
 * somebody deciding whether to set off wants to know, and only the people who
 * drove past it can say so.
 *
 * Colour is never the only signal. Every stretch also carries a marker with its
 * category icon, and the drawer behind it says the same thing in words — the
 * contest asks for WCAG 2.2 AA, and a map that answers "is this road open" in
 * hue alone fails for the readers who most need a straight answer.
 */
export type TrafficState = "active" | "cleared";

export const TRAFFIC_COLORS = {
  blocking: "#dc2626",
  partial: "#f59e0b",
  minor: "#eab308",
  cleared: "#16a34a",
} as const;

export type TrafficTone = keyof typeof TRAFFIC_COLORS;

export function trafficTone(
  state: TrafficState,
  severity: TrafficSeverity | null,
): TrafficTone {
  // Over is over, whatever it was. A cleared landslide is not a red road.
  if (state === "cleared") return "cleared";
  // A category with no severity set is the honest middle: something is there,
  // and nobody has said it blocks the road.
  return severity ?? "minor";
}

export function trafficColor(
  state: TrafficState,
  severity: TrafficSeverity | null,
): string {
  return TRAFFIC_COLORS[trafficTone(state, severity)];
}

/**
 * How long a cleared road keeps its green.
 *
 * Long enough to be the answer to "can I go that way now", short enough that
 * the map is not still congratulating itself tomorrow about a puddle. After
 * this the stretch simply disappears, like every other report.
 */
export const CLEARED_VISIBLE_HOURS = 3;

/**
 * How a street being chosen is drawn, before it is anything.
 *
 * Not a traffic colour. Red, amber and yellow each mean something on this map,
 * and a stretch that has not been reported yet must not borrow one of them —
 * the person has not said what is wrong. It is drawn in the interface's own
 * ink, the same as the pin and the buttons, which is what makes it read as a
 * selection laid over the map rather than as a report already on it. The
 * white caps at both ends say exactly where the stretch starts and stops,
 * which is the one thing the extent buttons change.
 */
export const STREET_SELECTION = {
  stroke: mapPalette.ink,
  hover: mapPalette.lineStrong,
  cap: "#ffffff",
} as const;
