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

export function markerPin(
  color: string,
  icon: string | undefined,
  selected: boolean,
): string {
  const key = `${color}|${icon}|${selected}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const Icon = categoryIcon(icon);

  // Only the contents are wanted; the wrapper <svg> is replaced by the pin's
  // own, which sets the size, colour and stroke for everything inside it.
  const glyph = renderToStaticMarkup(<Icon />)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");

  const scale = selected ? 1.3 : 1;
  const width = 30 * scale;
  const height = 40 * scale;

  // Google's own pin geometry: a near-circle that tapers to a point rather
  // than a teardrop with straight shoulders, and a soft ellipse on the ground
  // beneath it. The shadow is what makes a pin look like it is standing on the
  // map instead of printed onto it, and its absence was most of the difference.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 30 40">
    <ellipse cx="15" cy="37.5" rx="4.5" ry="1.8" fill="rgba(0,0,0,0.22)"/>
    <path
      d="M15 38.5C15 38.5 27 23.4 27 14.4A12 12 0 1 0 3 14.4C3 23.4 15 38.5 15 38.5Z"
      fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
    <g transform="translate(7.5 7)" fill="none" stroke="#ffffff"
       stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <g transform="scale(0.625)">${glyph}</g>
    </g>
  </svg>`;

  const uri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  cache.set(key, uri);
  return uri;
}

/** Anchor and size, so the pin's point sits on the coordinate. */
export function markerSize(selected: boolean) {
  const scale = selected ? 1.3 : 1;
  return { width: 30 * scale, height: 40 * scale };
}

/**
 * The blue dot for where the person is.
 *
 * The same shape every map uses, because it is the one marker people already
 * know how to read: a filled circle in a white ring, with a soft halo standing
 * for accuracy. Deliberately not shaped like a place pin — it is not a place,
 * and confusing the two would put "you" in the same visual class as a hospital.
 */
export function locationDot(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="#1a73e8" opacity="0.18"/>
    <circle cx="14" cy="14" r="8" fill="#ffffff"/>
    <circle cx="14" cy="14" r="6" fill="#1a73e8"/>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
