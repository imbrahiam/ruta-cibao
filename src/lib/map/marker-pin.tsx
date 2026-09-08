import { renderToStaticMarkup } from "react-dom/server";
import { categoryIcon } from "./category-icons";

/**
 * A map pin with the category's icon inside it.
 *
 * Drawn as an SVG data URI rather than a DOM marker, because a DOM marker means
 * Advanced Markers, Advanced Markers mean a Map ID, and a Map ID makes Google
 * ignore the custom style — which is the only way to hide Google's own places
 * from the map. Between a nicer marker implementation and being able to clear
 * the map of pins nobody here added, the second matters more.
 *
 * The icon comes from the same lucide component the rest of the interface uses,
 * rendered to markup rather than duplicated as path data, so a category's icon
 * is the same shape on the map as in the drawer.
 *
 * Results are memoised: there are as many pins as places, they redraw on every
 * pan, and the input is three short strings.
 */
const cache = new Map<string, string>();

/**
 * The pin, as one shape.
 *
 * It used to be three: a white disc, a coloured disc inside it, and a separate
 * arrow underneath — each carrying its own grey outline. At marker size those
 * outlines met at the shoulders and read as a seam, so the pin looked like two
 * pieces stacked rather than one object.
 *
 * This is a single closed path: a circle, and two straight lines from the tip
 * that are *tangent* to it. Tangency is what makes it one object — the line
 * meets the curve with no corner to see, so the silhouette flows from point to
 * shoulder with no join anywhere along it. Everything else follows from that:
 * one fill, one outline all the way round, one shadow.
 *
 * The numbers are derived rather than drawn by eye. With the disc at `CENTRE`,
 * radius `RADIUS`, and the tip below it, the touch points sit at
 * `acos(RADIUS / distance)` either side of straight down.
 *
 * How far the tip sits below the centre is the whole proportion of the pin, and
 * it is the one number worth understanding here. At two radii the touch points
 * land near the disc's widest part and the sides sweep down as a long triangle
 * — a lozenge with a circle at the top. Pulling the tip in to about 1.37 radii
 * moves them most of the way to the bottom of the disc, so what is left below
 * it is a short nub: the marker reads as a badge that happens to point at
 * something, which is what it is.
 */
const CENTRE = { x: 20, y: 18 } as const;
const RADIUS = 15;
const TIP_Y = 38.5;

/** Where the tangent lines from the tip touch the disc. */
const TANGENT = (() => {
  const distance = TIP_Y - CENTRE.y;
  const angle = Math.acos(RADIUS / distance);
  const dx = RADIUS * Math.sin(angle);
  const dy = RADIUS * Math.cos(angle);
  const round = (value: number) => Math.round(value * 1000) / 1000;

  return {
    left: { x: round(CENTRE.x - dx), y: round(CENTRE.y + dy) },
    right: { x: round(CENTRE.x + dx), y: round(CENTRE.y + dy) },
  };
})();

/**
 * The shape, as data.
 *
 * `pick-location` draws the same geometry as real SVG for the crosshair, so the
 * two are the same pin without either of them owning the other — data rather
 * than JSX, because the crosshair is a client component and
 * `renderToStaticMarkup` cannot run inside a render pass.
 */
export const PIN_GEOMETRY = {
  viewBox: "0 0 40 44",
  /**
   * Rendered smaller than it is drawn.
   *
   * The geometry stays in a roomy 40-unit box so the maths is readable; the
   * marker on screen is three quarters of that. A map with fifty pins on it is
   * mostly pins otherwise, and the thing they are meant to help you see is the
   * ground underneath.
   */
  width: 30,
  height: 33,
  centre: CENTRE,
  radius: RADIUS,
  /** Tip, up the left tangent, over the top, back down the right one. */
  silhouette: `M${CENTRE.x} ${TIP_Y} L${TANGENT.left.x} ${TANGENT.left.y} A${RADIUS} ${RADIUS} 0 1 1 ${TANGENT.right.x} ${TANGENT.right.y} Z`,
  /**
   * A white rim drawn *under* the fill through `paint-order`, so only its outer
   * half shows — 2.5 of the 5 below.
   *
   * Proportionally heavier than it was, because the pin is smaller: a hairline
   * that separated a 40px marker from the map disappears on a 30px one, and the
   * ring is what keeps a dark pin legible over satellite imagery.
   */
  rim: { color: "#ffffff", width: 5 },
  /** A 24×24 lucide icon lands centred on the disc with this transform. */
  glyph: { translate: "13.28 11.28", scale: 0.56, strokeWidth: 3.5 },
  /** The contact shadow on the ground, under the tip. */
  groundShadow: { cy: 42, rx: 3.8, ry: 1.2 },
} as const;

type Rgb = [number, number, number];

/** A `#rgb` or `#rrggbb` category colour as three 0–255 channels. */
function channels(color: string): Rgb {
  const hex = color.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => part + part)
          .join("")
      : hex;

  const at = (offset: number) => {
    const value = Number.parseInt(full.slice(offset, offset + 2), 16);
    return Number.isNaN(value) ? 0 : value;
  };

  return [at(0), at(2), at(4)];
}

/** WCAG relative luminance — how bright a colour reads, not how bright it is. */
function relativeLuminance([red, green, blue]: Rgb): number {
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/**
 * Which of two inks to put on a category's colour.
 *
 * Every icon used to be white, which is right for the greens, reds and blues
 * and wrong for the two yellows — `#eab308` under a white glyph is below 2:1,
 * so the icon that says *which* category this is was the part that disappeared.
 * Relative luminance decides instead, which means a municipality can add a pale
 * category from the admin panel without anybody having to think about it.
 */
export function readableOn(color: string): string {
  // 0.45 rather than the midpoint: white on a mid-tone reads better than near
  // black does, so the dark ink is kept for genuinely pale colours.
  return relativeLuminance(channels(color)) > 0.45 ? "#1c1917" : "#ffffff";
}

/**
 * The same colour, dark enough to be read as a name.
 *
 * A place label is the category's colour so that the word and the pin above it
 * are visibly the same thing — but a label is 11px of hairline letterform where
 * the pin is a 30px disc, and the two do not survive the same colour. `#eab308`
 * as a filled circle is a landmark; as text on the white halo it sits on it is
 * around 1.9:1, which is a smudge in the shape of a word.
 *
 * So the hue is kept and the colour is walked towards black until it clears
 * 4.5:1 against that halo. Solving the WCAG ratio for a white background gives
 * the ceiling below: anything darker passes AA at any size. Categories that are
 * already dark — most of them — come back untouched.
 */
const MAX_LABEL_LUMINANCE = 1.05 / 4.5 - 0.05;
const inkCache = new Map<string, string>();

export function labelInk(color: string): string {
  const hit = inkCache.get(color);
  if (hit) return hit;

  let rgb = channels(color);
  // Multiplying the encoded channels dims the colour without turning the hue,
  // which stepping in any other space would.
  for (
    let step = 0;
    step < 20 && relativeLuminance(rgb) > MAX_LABEL_LUMINANCE;
    step += 1
  ) {
    rgb = rgb.map((channel) => channel * 0.9) as Rgb;
  }

  const value = `#${rgb
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
  inkCache.set(color, value);
  return value;
}

/** The icon, as markup, with its wrapper `<svg>` stripped off. */
function glyphMarkup(icon: string | undefined): string {
  const Icon = categoryIcon(icon);

  // Only the contents are wanted; the wrapper is replaced by the pin's own,
  // which sets the size, colour and stroke for everything inside it.
  return renderToStaticMarkup(<Icon />)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");
}

function dataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function markerPin(
  color: string,
  icon: string | undefined,
  selected: boolean,
): string {
  const key = `${color}|${icon}|${selected}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const scale = selected ? 1.14 : 1;
  const { groundShadow, glyph, rim } = PIN_GEOMETRY;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_GEOMETRY.width * scale}" height="${PIN_GEOMETRY.height * scale}" viewBox="${PIN_GEOMETRY.viewBox}">
    <defs>
      <filter id="pin-shadow" x="-40%" y="-25%" width="180%" height="170%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#0f172a" flood-opacity="0.28"/>
      </filter>
    </defs>
    <ellipse cx="${CENTRE.x}" cy="${groundShadow.cy}" rx="${groundShadow.rx}" ry="${groundShadow.ry}" fill="#0f172a" opacity="0.16"/>
    <path d="${PIN_GEOMETRY.silhouette}" fill="${color}"
          stroke="${rim.color}" stroke-width="${rim.width}" stroke-linejoin="round"
          paint-order="stroke" filter="url(#pin-shadow)"/>
    <g transform="translate(${glyph.translate})" fill="none" stroke="${readableOn(color)}"
       stroke-width="${glyph.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
      <g transform="scale(${glyph.scale})">${glyphMarkup(icon)}</g>
    </g>
  </svg>`;

  const uri = dataUri(svg);
  cache.set(key, uri);
  return uri;
}

/** Anchor and size, so the pin's point sits on the coordinate. */
export function markerSize(selected: boolean) {
  const scale = selected ? 1.14 : 1;
  return {
    width: PIN_GEOMETRY.width * scale,
    height: PIN_GEOMETRY.height * scale,
  };
}

/**
 * The marker for something happening on the road.
 *
 * Deliberately not a place pin. A hoyo is an event, not a location you can
 * visit, and giving it the same teardrop shape as a clinic would put the two in
 * one class — so this is a rounded square standing on its corner, the shape
 * road signs already use for a hazard.
 *
 * Centred on its coordinate rather than anchored by a tail, because an event
 * covers a stretch of road rather than sitting on one point of it. Same rim,
 * same shadow, same ink rule as the pin: two shapes, one family.
 */
export const ALERT_GEOMETRY = { size: 28, viewBox: "0 0 40 40" } as const;

export function alertPin(
  color: string,
  icon: string | undefined,
  selected: boolean,
): string {
  const key = `alert|${color}|${icon}|${selected}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const scale = selected ? 1.14 : 1;
  const size = ALERT_GEOMETRY.size * scale;
  const { rim } = PIN_GEOMETRY;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${ALERT_GEOMETRY.viewBox}">
    <defs>
      <filter id="alert-shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="#0f172a" flood-opacity="0.28"/>
      </filter>
    </defs>
    <rect x="7" y="7" width="26" height="26" rx="7" transform="rotate(45 20 20)"
          fill="${color}" stroke="${rim.color}" stroke-width="${rim.width}" stroke-linejoin="round"
          paint-order="stroke" filter="url(#alert-shadow)"/>
    <g transform="translate(13.28 13.28)" fill="none" stroke="${readableOn(color)}"
       stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
      <g transform="scale(0.56)">${glyphMarkup(icon)}</g>
    </g>
  </svg>`;

  const uri = dataUri(svg);
  cache.set(key, uri);
  return uri;
}

/** Size for an alert marker, which sits centred on its coordinate. */
export function alertSize(selected: boolean) {
  const scale = selected ? 1.14 : 1;
  return {
    width: ALERT_GEOMETRY.size * scale,
    height: ALERT_GEOMETRY.size * scale,
  };
}
