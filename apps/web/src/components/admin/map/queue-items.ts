import type { ApiOutputs, EcoRoute } from "@ruta/contracts";
import { trafficColor, trafficTone } from "@ruta/shared/traffic";
import type { LatLng, MapItem } from "./map-types";

type Place = ApiOutputs["moderation"]["queue"]["places"][number];
type Traffic = ApiOutputs["moderation"]["queue"]["traffic"][number];

/** A pending place: a pin in its category's colour. */
export function placeMapItem(place: Place): MapItem {
  return {
    kind: "place",
    id: place.id,
    label: place.name,
    lat: place.lat,
    lng: place.lng,
    icon: place.categoryIcon,
    color: place.categoryColor,
  };
}

/**
 * A live traffic report. Everything in the queue is still active, so its
 * colour is its severity's, exactly as the phone app draws it.
 */
export function trafficMapItem(report: Traffic): MapItem {
  return {
    kind: "traffic",
    id: report.id,
    label: report.categoryName,
    lat: report.lat,
    lng: report.lng,
    icon: report.categoryIcon,
    color: trafficColor("active", report.severity),
    cleared: false,
    path: report.path,
  };
}

export function trafficReportTone(report: Traffic) {
  return trafficTone("active", report.severity);
}

export function routeMapItem(route: EcoRoute): MapItem {
  return { kind: "route", id: route.id, label: route.name, path: route.path };
}

/** Where a copied coordinate or an external link points. */
export function routeAnchor(route: EcoRoute): LatLng {
  return route.path[0] ?? { lat: 0, lng: 0 };
}
