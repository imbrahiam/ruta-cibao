import type { MapStyleElement } from "react-native-maps";
import { mapPalettes, type Scheme } from "@/ui/theme";

/**
 * Basemap style for Google Maps, built from `mapPalettes` in the theme.
 *
 * Google's own points of interest and transit are switched off: the places on
 * this map are the ones the province curates, drawn by the app on top, and two
 * competing sets of pins would contradict each other. Roads stay legible
 * because reporting traffic and finding a street are what the map is for.
 */
function styleFor(scheme: Scheme): MapStyleElement[] {
  const m = mapPalettes[scheme];
  return [
    { elementType: "geometry", stylers: [{ color: m.ground }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: m.label }] },
    { elementType: "labels.text.stroke", stylers: [{ color: m.labelHalo }] },
    {
      featureType: "administrative",
      elementType: "geometry.stroke",
      stylers: [{ color: m.adminLine }],
    },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: m.labelStrong }],
    },
    {
      featureType: "administrative.land_parcel",
      stylers: [{ visibility: "off" }],
    },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ visibility: "on" }, { color: m.park }],
    },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: m.road }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: m.roadEdge }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: m.highway }],
    },
    {
      featureType: "road.arterial",
      elementType: "labels.text.fill",
      stylers: [{ color: m.label }],
    },
    {
      featureType: "road.local",
      elementType: "labels.text.fill",
      stylers: [{ color: m.labelMuted }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: m.water }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: m.waterLabel }],
    },
  ];
}

export const mapStyles: Record<Scheme, MapStyleElement[]> = {
  light: styleFor("light"),
  dark: styleFor("dark"),
};
