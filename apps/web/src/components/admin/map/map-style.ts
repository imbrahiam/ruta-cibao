/// <reference types="google.maps" />

import {
  type ColoresPalette,
  MAP_PALETTES,
  type MapPalette,
  type Scheme,
} from "./palette";
import { roadWeight } from "./road-stretch";

/**
 * The staff desk's road-map styles. Both turn Google's own points of interest
 * and transit off, because the places on this map are the ones the province
 * curates; roads stay legible.
 *
 * Every road is filled with the same `weight` for the zoom (`roadWeight`), so
 * the highlight drawn over a stretch can be exactly as wide as the street.
 * Google's own widths vary by road class and by what the road is, which no
 * API reports, so they cannot be matched; a style that fixes them can. The
 * style API rounds weights to whole pixels and the map restyles when the zoom
 * crosses a level, so pass the map's current zoom. A new style MUST set
 * `weight` on `road` and `road.highway` fills and nothing else that changes a
 * road's width; only colours differ between styles.
 */
type StyleFactory = (
  scheme: Scheme,
  zoom: number,
) => google.maps.MapTypeStyle[];

/**
 * `gris`: the phone app's muted gray style (`styleFor` in
 * `apps/mobile/src/features/map/basemap.ts`).
 */
const gris: StyleFactory = (scheme, zoom) => {
  const m: MapPalette = MAP_PALETTES.gris[scheme];
  const weight = roadWeight(zoom);
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
      elementType: "geometry.fill",
      stylers: [{ color: m.road }, { weight }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: m.roadEdge }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.fill",
      stylers: [{ color: m.highway }, { weight }],
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
};

/** Pastel land, green vegetation and blue water retain the calibrated roads. */
const colores: StyleFactory = (scheme, zoom) => {
  const m: ColoresPalette = MAP_PALETTES.colores[scheme];
  const weight = roadWeight(zoom);
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
    {
      featureType: "landscape.natural",
      elementType: "geometry.fill",
      stylers: [{ color: m.natural }],
    },
    {
      featureType: "landscape.man_made",
      elementType: "geometry.fill",
      stylers: [{ color: m.building }],
    },
    {
      featureType: "landscape.man_made",
      elementType: "geometry.stroke",
      stylers: [{ color: m.buildingEdge }],
    },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ visibility: "on" }, { color: m.park }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ visibility: "on" }, { color: m.parkLabel }],
    },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    {
      featureType: "road",
      elementType: "geometry.fill",
      stylers: [{ color: m.road }, { weight }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: m.roadEdge }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.fill",
      stylers: [{ color: m.highway }, { weight }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: m.highwayEdge }],
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
};

export const MAP_STYLES = { colores, gris } satisfies Record<
  keyof typeof MAP_PALETTES,
  StyleFactory
>;

export type MapStyleId = keyof typeof MAP_STYLES;

/** The desk's default: the recognisable coloured map. */
export const DEFAULT_MAP_STYLE: MapStyleId = "gris";

export const MAP_STYLE_IDS = Object.keys(MAP_STYLES) as MapStyleId[];

/** The Google Maps style for a style id, scheme and the map's current zoom. */
export function mapStyle(
  id: MapStyleId,
  scheme: Scheme,
  zoom: number,
): google.maps.MapTypeStyle[] {
  return MAP_STYLES[id](scheme, zoom);
}

/** Shown while tiles load: the ground colour of the style. */
export function mapBackground(id: MapStyleId, scheme: Scheme): string {
  return MAP_PALETTES[id][scheme].ground;
}
