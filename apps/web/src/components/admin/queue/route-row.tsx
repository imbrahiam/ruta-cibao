"use client";

import type { DecideRouteInput, EcoRoute } from "@ruta/contracts";
import { MapPin, Signpost } from "lucide-react";
import { useId, useMemo } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useDay } from "@/components/admin/use-day";
import { api } from "@/lib/web/api";
import { MapPreview } from "../map/map-preview";
import { routeMapItem } from "../map/queue-items";
import { useMapCopy } from "../map/use-map-copy";
import { DecisionBar } from "./decision-bar";
import { Fact, Facts, ItemRow, MunicipalityTag, useWhen } from "./item-parts";
import {
  Ago,
  Ficha,
  FichaItem,
  GlyphTile,
  Pill,
  Quote,
  ReviewLine,
  ReviewSheet,
} from "./review-ui";
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
      {...(large ? { mapClassName: "aspect-[21/9] rounded-xl" } : {})}
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

/** The route in the list: its name and how long ago, then where and how long it is. */
export function RouteLine({ route }: { route: EcoRoute }) {
  const split = useSplit();
  const { distance, duration } = useRouteFigures(route);
  return (
    <ReviewLine
      selected={split?.selected === route.id}
      onSelect={() => split?.select(route.id)}
      title={route.name}
      end={<Ago iso={route.createdAt} />}
      meta={`${route.municipalityName} · ${distance} · ${duration}`}
      lead={<GlyphTile icon={Signpost} />}
    />
  );
}

/**
 * One route to decide: its line on a large map first, the three figures a
 * walker asks about, then the description and the rest, and the decision
 * pinned to the foot.
 */
export function RouteDetail({ route }: { route: EcoRoute }) {
  const id = useId();
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const day = useDay();
  const { distance, duration } = useRouteFigures(route);
  const received = new Date(route.createdAt);
  return (
    <ReviewSheet
      titleId={`${id}-title`}
      title={route.name}
      lead={<GlyphTile icon={Signpost} large />}
      pills={
        <>
          <Pill>{route.categoryName}</Pill>
          <Pill icon={MapPin}>
            <span className="sr-only">{t("municipality")}: </span>
            {route.municipalityName}
          </Pill>
        </>
      }
      footer={<RouteDecision route={route} id={id} />}
    >
      <RouteMap route={route} large />
      <dl className="grid grid-cols-3 gap-3">
        {[
          [q("distance"), distance],
          [q("duration"), duration],
          [q("difficulty"), q(`difficultyLevel.${route.difficulty}`)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-xl border px-4 py-3"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tracking-tight tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {route.description ? (
        <Quote label={q("description")}>{route.description}</Quote>
      ) : null}
      <Ficha>
        <FichaItem label={q("services")}>
          {route.services.length > 0
            ? route.services
                .map((service) => q(`service.${service}`))
                .join(", ")
            : null}
        </FichaItem>
        <FichaItem label={q("sheet.received")}>
          {q("untilDate", {
            date: day(received),
            time: format.dateTime(received, "time"),
          })}
        </FichaItem>
      </Ficha>
    </ReviewSheet>
  );
}
