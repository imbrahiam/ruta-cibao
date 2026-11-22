"use client";

import type { DecideRouteInput, EcoRoute } from "@ruta/contracts";
import { Signpost } from "lucide-react";
import { useId, useMemo } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { api } from "@/lib/web/api";
import { MapPreview } from "../map/map-preview";
import { routeMapItem } from "../map/queue-items";
import { useMapCopy } from "../map/use-map-copy";
import { DecisionBar } from "./decision-bar";
import {
  DeskLine,
  Fact,
  Facts,
  ItemRow,
  MunicipalityTag,
  useWhen,
} from "./item-parts";
import { useSplit } from "./split";
import { type Body, useDecision } from "./use-decision";

const NOTE = { min: 5, max: 1000 } as const;

/** A route's length and time as people say them: "4.2 km" and "1 h 20 min". */
function useRouteFigures(route: EcoRoute) {
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const hours = Math.floor(route.durationMinutes / 60);
  const minutes = route.durationMinutes % 60;
  return {
    distance: format.number(route.distanceMeters / 1000, "distance"),
    duration:
      hours > 0
        ? q("durationHours", { hours, minutes })
        : q("durationMinutes", { minutes }),
  };
}

/** Publish or reject one route; the same bar wherever the route is shown. */
function RouteDecision({ route, id }: { route: EcoRoute; id: string }) {
  const t = useTranslations("admin");
  const { decide, pending, error } = useDecision<Body<DecideRouteInput>>(
    (input) => api.routes.decide(input),
    { queue: "routes", id: route.id },
  );
  return (
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
        onConfirm: (note) => decide({ id: route.id, status: "rejected", note }),
      }}
    />
  );
}

function RouteFacts({ route }: { route: EcoRoute }) {
  const q = useTranslations("admin.queue");
  const { distance, duration } = useRouteFigures(route);
  return (
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
          ? route.services.map((service) => q(`service.${service}`)).join(", ")
          : null}
      </Fact>
    </Facts>
  );
}

function RouteMap({ route, large }: { route: EcoRoute; large?: boolean }) {
  const q = useTranslations("admin.queue");
  const map = useMapCopy();
  const mapItem = useMemo(() => routeMapItem(route), [route]);
  const { distance } = useRouteFigures(route);
  const start = route.path[0];
  if (!start) return null;
  return (
    <MapPreview
      className="max-w-none"
      {...(large ? { mapClassName: "aspect-[2/1]" } : {})}
      item={mapItem}
      label={map.routeAlt(route)}
      title={route.name}
      legend={map.routeLegend()}
      summary={`${q("distance")}: ${distance}`}
      anchor={start}
      anchorLabel={q("pathStart")}
    />
  );
}

export function RouteRow({ route }: { route: EcoRoute }) {
  const id = useId();
  const when = useWhen();
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
      media={<RouteMap route={route} />}
      detail={<RouteFacts route={route} />}
      decision={<RouteDecision route={route} id={id} />}
    />
  );
}

/** The route in the list beside the selected one: its name, where, how long and since when. */
export function RouteLine({ route }: { route: EcoRoute }) {
  const split = useSplit();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { distance, duration } = useRouteFigures(route);
  return (
    <DeskLine
      selected={split?.selected === route.id}
      onSelect={() => split?.select(route.id)}
      title={route.name}
      lead={
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-muted text-muted-foreground">
          <Signpost aria-hidden="true" className="size-[18px]" />
        </span>
      }
    >
      <p className="truncate text-[13px] text-muted-foreground">
        {route.municipalityName} · {route.categoryName}
      </p>
      <p className="flex min-w-0 items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span className="truncate tabular-nums">
          {distance} · {duration}
        </span>
        <time dateTime={route.createdAt} className="shrink-0 tabular-nums">
          {format.relativeTime(new Date(route.createdAt), now)}
        </time>
      </p>
    </DeskLine>
  );
}

/** Everything needed to decide one route: what it is, its facts, the decision, and its line on a large map. */
export function RouteDetail({ route }: { route: EcoRoute }) {
  const id = useId();
  const when = useWhen();
  return (
    <article aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <h2
          id={`${id}-title`}
          className="text-xl leading-tight font-semibold text-balance"
        >
          {route.name}
        </h2>
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex flex-wrap items-center gap-x-2">
            <MunicipalityTag name={route.municipalityName} />
            {route.categoryName}
          </span>
          <span className="text-[13px]">
            {when("receivedAt", route.createdAt)}
          </span>
        </p>
      </header>
      <RouteFacts route={route} />
      <div className="rounded-(--radius-card) bg-muted/60 p-3">
        <RouteDecision route={route} id={id} />
      </div>
      <RouteMap route={route} large />
    </article>
  );
}
