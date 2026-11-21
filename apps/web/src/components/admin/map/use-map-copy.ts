"use client";

import type { ApiOutputs, EcoRoute } from "@ruta/contracts";
import { TRAFFIC_COLORS, type TrafficTone } from "@ruta/shared/traffic";
import { useFormatter, useTranslations } from "use-intl";
import type { LegendEntry } from "./legend";
import { formatCoordinates } from "./map-links";
import { trafficReportTone } from "./queue-items";

type Place = ApiOutputs["moderation"]["queue"]["places"][number];
type Traffic = ApiOutputs["moderation"]["queue"]["traffic"][number];

/**
 * The words around a map: its text alternative and its legend, for each kind
 * of item the desk shows.
 */
export function useMapCopy() {
  const t = useTranslations("admin.queue.map");
  const q = useTranslations("admin.queue");
  const a = useTranslations("admin");
  const format = useFormatter();

  const tone = (value: TrafficTone) =>
    value === "cleared" ? t("cleared") : a(value);
  const kilometres = (metres: number) =>
    format.number(metres / 1000, "distance");

  return {
    placeAlt: (place: Place) =>
      t("placeAlt", {
        name: place.name,
        coordinates: formatCoordinates(place),
      }),

    trafficAlt: (report: Traffic) =>
      report.path && report.lengthMeters !== null
        ? t("stretchAlt", {
            name: report.categoryName,
            municipality: report.municipalityName,
            length: report.lengthMeters,
          })
        : t("pointAlt", {
            name: report.categoryName,
            municipality: report.municipalityName,
            coordinates: formatCoordinates(report),
          }),

    routeAlt: (route: EcoRoute) =>
      t("routeAlt", {
        name: route.name,
        points: route.path.length,
        distance: kilometres(route.distanceMeters),
      }),

    queueAlt: (kind: "places" | "traffic" | "routes", count: number) =>
      t(`queueAlt.${kind}`, { count }),

    /** One entry per category on show: its colour and its name. */
    placesLegend: (places: Place[]): LegendEntry[] => [
      ...new Map(
        places.map((place) => [
          place.categoryName,
          {
            key: place.categoryName,
            swatch: "disc" as const,
            color: place.categoryColor,
            label: place.categoryName,
          },
        ]),
      ).values(),
    ],

    /** One report: its severity, and the stretch it covers when it has one. */
    trafficLegend: (reports: Traffic[]): LegendEntry[] => {
      const entries: LegendEntry[] = [];
      const seen = new Set<TrafficTone>();
      for (const report of reports) {
        const value = trafficReportTone(report);
        if (seen.has(value)) continue;
        seen.add(value);
        entries.push({
          key: value,
          swatch: "disc",
          color: TRAFFIC_COLORS[value],
          label: tone(value),
        });
      }
      const single = reports.length === 1 ? reports[0] : undefined;
      if (single?.path && single.lengthMeters !== null) {
        entries.push({
          key: "stretch",
          swatch: "line",
          color: TRAFFIC_COLORS[trafficReportTone(single)],
          label: t("stretchLength", { length: single.lengthMeters }),
        });
      } else if (reports.some((report) => report.path)) {
        entries.push({ key: "stretch", swatch: "line", label: t("stretch") });
      }
      return entries;
    },

    routeLegend: (): LegendEntry[] => [
      // The trail and its ends are drawn in the brand's pine (`MAP_INK`).
      {
        key: "trail",
        swatch: "line",
        color: "var(--primary)",
        label: t("trail"),
      },
      {
        key: "start",
        swatch: "disc",
        color: "var(--primary)",
        label: q("pathStart"),
      },
      {
        key: "end",
        swatch: "square",
        color: "var(--primary)",
        label: q("pathEnd"),
      },
    ],
  };
}

export type MapCopy = ReturnType<typeof useMapCopy>;
