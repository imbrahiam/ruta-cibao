import { mapPalette } from "./palette";

/**
 * The Google basemap, in the app's greys.
 *
 * Classic styled-map JSON rather than a cloud-hosted Map ID: it lives in the
 * repository, so the styling ships with the code instead of being a setting in
 * someone's Google Cloud console that the municipality would have to be handed
 * separately.
 *
 * Same intent as the other renderers — the ground recedes and the roads are the
 * bright thing on it — and points of interest are turned off entirely, because
 * Google's own pins compete with the ones the province put there, which are the
 * whole reason for the map.
 */
export const googleMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: mapPalette.land }] },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: mapPalette.lineStrong }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: mapPalette.labelHalo }],
  },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },

  // Google's own places, hidden. The map is for what citizens add to it.
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },

  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: mapPalette.land }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: mapPalette.green }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: mapPalette.water }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: mapPalette.waterLabel }],
  },

  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: mapPalette.road }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: mapPalette.roadCasing }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: mapPalette.road }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: mapPalette.line }],
  },
  {
    featureType: "road.local",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },

  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: mapPalette.line }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: mapPalette.lineStrong }],
  },
];

/**
 * A marker in the category's colour.
 *
 * Drawn as an inline SVG data URI rather than shipped as image files: the
 * taxonomy is edited by the municipality at runtime, so the colour is only
 * known then, and generating the pin is cheaper than keeping a sprite sheet in
 * step with a table someone else edits.
 */
export function markerIcon(color: string, selected: boolean): string {
  const radius = selected ? 11 : 8;
  const ring = selected ? 4 : 2;
  const size = (radius + ring) * 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="${color}" stroke="${mapPalette.road}" stroke-width="${ring}"/>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
