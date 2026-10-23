/**
 * Something a link, a notification or a share can point at.
 *
 * One canonical path per thing, `/s/<kind>/<ref>`, understood by the native app
 * (deep links, notification taps) and served by the web as a public share page.
 * `ref` is a place slug, a route id, a consultation slug, a traffic report id,
 * or a weekly report id.
 */
export const TARGET_KINDS = [
  "place",
  "route",
  "consultation",
  "traffic",
  "report",
] as const;

export type TargetKind = (typeof TARGET_KINDS)[number];

export type AppTarget =
  | { kind: TargetKind; ref: string }
  | { kind: "contributions" };

export function appTargetHref(target: AppTarget): string {
  if (target.kind === "contributions") return "/contributions";
  return `/s/${target.kind}/${encodeURIComponent(target.ref)}`;
}

/** Reads a canonical href back into a target; anything else is not a target. */
export function parseAppTarget(href: string): AppTarget | null {
  const path =
    href.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").split(/[?#]/)[0] ?? "";
  if (path === "/contributions") return { kind: "contributions" };
  const match = /^\/s\/([a-z]+)\/([^/]+)$/.exec(path);
  if (!match) return null;
  const kind = match[1] as TargetKind;
  if (!TARGET_KINDS.includes(kind)) return null;
  return { kind, ref: decodeURIComponent(match[2] ?? "") };
}
