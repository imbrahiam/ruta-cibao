"use client";

import type { DecideRouteInput, EcoRoute } from "@ruta/contracts";
import { useId, useMemo } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { api } from "@/lib/web/api";
import { MapPreview } from "../map/map-preview";
import { routeMapItem } from "../map/queue-items";
import { useMapCopy } from "../map/use-map-copy";
import { DecisionBar } from "./decision-bar";
import { Fact, Facts, ItemRow, MunicipalityTag, useWhen } from "./item-parts";
import { type Body, useDecision } from "./use-decision";

const NOTE = { min: 5, max: 1000 } as const;

export function RouteRow({ route }: { route: EcoRoute }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const id = useId();
  const when = useWhen();
  const map = useMapCopy();
  const mapItem = useMemo(() => routeMapItem(route), [route]);
  const start = route.path[0];
  const distance = format.number(route.distanceMeters / 1000, "distance");
  const { decide, pending, error } = useDecision<Body<DecideRouteInput>>(
    (input) => api.routes.decide(input),
    { queue: "routes", id: route.id },
  );

  const hours = Math.floor(route.durationMinutes / 60);
  const minutes = route.durationMinutes % 60;
  const duration =
    hours > 0
      ? q("durationHours", { hours, minutes })
      : q("durationMinutes", { minutes });

  return (
    <ItemRow
      titleId={`${id}-title`}
      itemId={route.id}
      title={route.name}
      meta={
        <>
          <MunicipalityTag name={route.municipalityName} />
          {route.categoryName}
        </>
      }
      byline={when("receivedAt", route.createdAt)}
      detail={
        // The map and the facts sit side by side when the row is wide enough
        // (not the window: beside the queue map the row is a narrow column).
        <div className="grid gap-5 @2xl/item:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] @2xl/item:items-start">
          {start ? (
            <MapPreview
              className="max-w-none"
              item={mapItem}
              label={map.routeAlt(route)}
              title={route.name}
              legend={map.routeLegend()}
              summary={`${q("distance")}: ${distance}`}
              anchor={start}
              anchorLabel={q("pathStart")}
            />
          ) : null}
          <Facts>
            <Fact label={q("description")} wide>
              {route.description}
            </Fact>
            <Fact label={q("distance")}>{distance}</Fact>
            <Fact label={q("duration")}>{duration}</Fact>
            <Fact label={q("difficulty")}>
              {q(`difficultyLevel.${route.difficulty}`)}
            </Fact>
            <Fact label={q("services")}>
              {route.services.length > 0
                ? route.services
                    .map((service) => q(`service.${service}`))
                    .join(", ")
                : null}
            </Fact>
          </Facts>
        </div>
      }
      decision={
        <DecisionBar
          id={id}
          subject={route.name}
          pending={pending}
          error={error}
          primary={{
            label: t("publish"),
            note: NOTE,
            onConfirm: (note) =>
              decide({ id: route.id, status: "published", note }),
          }}
          secondary={{
            label: t("reject"),
            destructive: true,
            note: NOTE,
            onConfirm: (note) =>
              decide({ id: route.id, status: "rejected", note }),
          }}
        />
      }
    />
  );
}
