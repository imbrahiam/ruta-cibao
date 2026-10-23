import { Platform } from "react-native";
import {
  type MapStyleElement,
  type MapViewProps,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { MAP_PROVIDER } from "@/lib/config";
import { mapPalettes, type Scheme } from "@/ui/theme";

/**
 * Everything a `MapView` needs to draw the basemap, for every map in the app.
 *
 * Google Maps is the basemap, styled from `mapPalettes`. Apple Maps is the
 * iOS alternative (`EXPO_PUBLIC_MAP_PROVIDER=apple`) for a build whose Google
 * key cannot serve tiles: MapKit takes no style JSON, so it gets its muted
 * variant with the scheme's appearance and no points of interest. Android has
 * only Google.
 */
export function basemapProps(
  scheme: Scheme,
  basemap: "standard" | "satellite" = "standard",
): Partial<MapViewProps> {
  const satellite = basemap === "satellite";
  if (MAP_PROVIDER === "apple" && Platform.OS === "ios") {
    return {
      provider: PROVIDER_DEFAULT,
      mapType: satellite ? "hybrid" : "mutedStandard",
      showsPointsOfInterests: false,
      userInterfaceStyle: scheme,
    };
  }
  return {
    provider: PROVIDER_GOOGLE,
    customMapStyle: satellite ? undefined : mapStyles[scheme],
    mapType: satellite ? "hybrid" : "standard",
  };
}

/*
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

const mapStyles: Record<Scheme, MapStyleElement[]> = {
  light: styleFor("light"),
  dark: styleFor("dark"),
};
