"use client";

import type { DecideRouteInput, EcoRoute } from "@ruta/contracts";
import { useId } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { Tag } from "@/components/ui/tag";
import { api } from "@/lib/web/api";
import { DecisionBar } from "./decision-bar";
import {
  Fact,
  Facts,
  ItemRow,
  ItemTitle,
  MunicipalityTag,
  useWhen,
} from "./item-parts";
import { RoutePreview } from "./route-preview";
import { type Body, useDecision } from "./use-decision";

const NOTE = { min: 5, max: 1000 } as const;

export function RouteRow({ route }: { route: EcoRoute }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const id = useId();
  const when = useWhen();
  const { decide, pending, error, decided } = useDecision<
    Body<DecideRouteInput>
  >((input) => api.routes.decide(input));

  const hours = Math.floor(route.durationMinutes / 60);
  const minutes = route.durationMinutes % 60;
  const duration =
    hours > 0
      ? q("durationHours", { hours, minutes })
      : q("durationMinutes", { minutes });

  return (
    <ItemRow
      titleId={`${id}-title`}
      item={
        <>
          <ItemTitle id={`${id}-title`}>{route.name}</ItemTitle>
          <div className="flex flex-wrap gap-1.5">
            <MunicipalityTag name={route.municipalityName} />
            <Tag tone="accent">{route.categoryName}</Tag>
          </div>
          <p className="t-small text-ink-2">
            {when("receivedAt", route.createdAt)}
          </p>
          <RoutePreview
            path={route.path}
            distanceMeters={route.distanceMeters}
          />
        </>
      }
      detail={
        <Facts>
          <Fact label={q("description")}>{route.description}</Fact>
          <Fact label={q("distance")}>
            {format.number(route.distanceMeters / 1000, "distance")}
          </Fact>
          <Fact label={q("duration")}>{duration}</Fact>
          <Fact label={q("difficulty")}>
            {q(`difficultyLevel.${route.difficulty}`)}
          </Fact>
          <Fact label={q("services")}>
            {route.services.length > 0
              ? route.services
                  .map((service) => q(`service.${service}`))
                  .join(", ")
              : q("noServices")}
          </Fact>
        </Facts>
      }
      decision={
        <DecisionBar
          id={id}
          subject={route.name}
          pending={pending}
          error={error}
          decided={decided}
          primary={{
            label: t("publish"),
            note: NOTE,
            onConfirm: (note) =>
              decide({ id: route.id, status: "published", note }),
          }}
          secondary={{
            label: t("reject"),
            variant: "danger",
            note: NOTE,
            onConfirm: (note) =>
              decide({ id: route.id, status: "rejected", note }),
          }}
        />
      }
    />
  );
}
