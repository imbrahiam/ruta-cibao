import { MAP_PALETTES, type Scheme } from "./palette";

/**
 * The colour a stretch is drawn in, adjusted so the line stays visible on the
 * ground it lies on (WCAG 2.2 non-text contrast, 3:1).
 *
 * The line is exactly as wide as the road's fill, so it is seen against the
 * road fill and, where the road meets them, the park, water, highway and
 * built-up tones. The severity colours were picked for white paper: the two
 * ambers and the green sit under 3:1 on a white road, and on a dark road
 * even the red does. Instead of a halo (which would spill over the street
 * and break the calibration of the line to the fill) the colour itself is
 * mixed toward black on the light map and toward white on the dark one, in
 * the smallest steps that clear the bar against every surface of the style.
 * Colours that already clear it, ink included, are returned untouched.
 */
export const MIN_CONTRAST = 3;

export type StretchBasemap = keyof typeof MAP_PALETTES;

type Rgb = [number, number, number];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function parse(hex: string): Rgb | null {
  const match = HEX.exec(hex);
  const digits = match?.[1];
  if (!digits) return null;
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((c) => Math.round(c).toString(16).padStart(2, "0"))
    .join("")}`;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rgb`/`#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const ca = parse(a);
  const cb = parse(b);
  if (!ca || !cb) return Number.NaN;
  const [light, dark] = [luminance(ca), luminance(cb)].sort(
    (x, y) => y - x,
  ) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** What a stretch lies on or crosses in a style: everything but labels. */
export function surfacesOf(basemap: StretchBasemap, scheme: Scheme): string[] {
  const p = MAP_PALETTES[basemap][scheme];
  return [
    p.ground,
    p.park,
    p.water,
    p.road,
    p.highway,
    ...("natural" in p ? [p.natural, p.building] : []),
  ];
}

const cache = new Map<string, string>();

export function stretchColor(
  color: string,
  basemap: StretchBasemap,
  scheme: Scheme,
): string {
  const key = `${basemap}:${scheme}:${color}`;
  const known = cache.get(key);
  if (known) return known;

  const rgb = parse(color);
  const surfaces = surfacesOf(basemap, scheme);
  const worst = (candidate: string) =>
    Math.min(...surfaces.map((surface) => contrastRatio(candidate, surface)));

  let result = color;
  if (rgb && worst(color) < MIN_CONTRAST) {
    const target = scheme === "light" ? 0 : 255;
    for (let step = 1; step <= 50; step++) {
      const mix = step / 50;
      const next = toHex(rgb.map((c) => c + (target - c) * mix) as Rgb);
      result = next;
      if (worst(next) >= MIN_CONTRAST) break;
    }
  }
  cache.set(key, result);
  return result;
}
