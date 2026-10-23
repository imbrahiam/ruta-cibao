/** Mirrors the `traffic_severity` database enum. */
export const TRAFFIC_SEVERITIES = ["blocking", "partial", "minor"] as const;
export type TrafficSeverity = (typeof TRAFFIC_SEVERITIES)[number];

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
  // Genesis status tokens: danger, warning, a lighter step of warning, success.
  blocking: "#d4483a",
  partial: "#c98a1b",
  minor: "#d9ad4b",
  cleared: "#2e9e6b",
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
