import { mapPalette } from "./palette";

/**
 * A clean street map that traffic reads well on.
 *
 * Deliberately lighter-handed than the fully desaturated version this
 * replaced. The traffic layer paints roads green through red, and that only
 * reads if the roads underneath are pale and uniform — a grey wash over
 * everything flattened the difference and made the colours look muddy.
 *
 * So: roads white with a soft casing, water and parks keep enough colour to
 * orient someone, and everything else recedes. Google's own points of interest
 * stay off — its pins compete with the ones the province put there, which are
 * the whole reason for the map.
 *
 * Kept as JSON in the repository rather than a cloud-hosted Map ID, so the
 * styling ships with the code instead of living in a console setting the
 * municipality would have to be handed separately.
 */
export const googleMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f3f4f6" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4b5563" }] },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#ffffff" }, { weight: 2 }],
  },

  // Google's own places, hidden. The map is for what citizens add to it.
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },

  // Enough green and blue to read the land at a glance, no more.
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#eef1ee" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#dbeadb" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c5dcea" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7d9bad" }],
  },

  // The network. Pale and uniform, so the traffic overlay is the only thing
  // on a road carrying colour.
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e3e5e8" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry.fill",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d8dbe0" }],
  },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry.stroke",
    stylers: [{ color: "#cfd3d9" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b7280" }],
  },

  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d6d8dc" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#374151" }],
  },
];

/**
 * A marker in the category's colour.
 *
 * Drawn as an inline SVG data URI rather than shipped as image files: the
 * taxonomy is edited by the municipality at runtime, so the colour is only
 * known then, and generating the pin is cheaper than keeping a sprite sheet in
 * step with a table someone else edits.
 *
 * A drop shadow, because the traffic overlay puts saturated colour on the roads
 * these sit over and a flat circle stops reading against it.
 */
export function markerIcon(color: string, selected: boolean): string {
  const radius = selected ? 11 : 8;
  const ring = selected ? 4 : 2.5;
  const pad = 4;
  const size = (radius + ring + pad) * 2;
  const center = size / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${center}" cy="${center}" r="${radius + ring / 2}" fill="${mapPalette.ink}" opacity="0.18"/>
    <circle cx="${center}" cy="${center}" r="${radius}" fill="${color}" stroke="#ffffff" stroke-width="${ring}"/>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
