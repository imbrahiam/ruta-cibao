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

  // Rendered at 24 and scaled down, which is the size lucide's stroke widths
  // are designed for; drawing it small directly makes the strokes muddy.
  // Only the contents are wanted; the wrapper <svg> is replaced by the pin's
  // own, which sets the size, colour and stroke for everything inside it.
  const glyph = renderToStaticMarkup(<Icon />)
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>$/, "");

  const scale = selected ? 1.25 : 1;
  const width = 32 * scale;
  const height = 42 * scale;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 32 42">
    <path
      d="M16 41C16 41 30 25.5 30 16A14 14 0 1 0 2 16C2 25.5 16 41 16 41Z"
      fill="${color}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
    <g transform="translate(8 8) scale(0.667)" fill="none" stroke="#ffffff"
       stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      ${glyph}
    </g>
  </svg>`;

  const uri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  cache.set(key, uri);
  return uri;
}

/** Anchor and size, so the pin's point sits on the coordinate. */
export function markerSize(selected: boolean) {
  const scale = selected ? 1.25 : 1;
  return { width: 32 * scale, height: 42 * scale };
}
