"use client";

import type { ApiOutputs, DecidePlaceInput } from "@ruta/contracts";
import { useId, useMemo } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { CategoryPin } from "@/components/category/category-pin";
import { api } from "@/lib/web/api";
import { MapPreview } from "../map/map-preview";
import { placeMapItem } from "../map/queue-items";
import { useMapCopy } from "../map/use-map-copy";
import { DecisionBar } from "./decision-bar";
import {
  DeskLine,
  Fact,
  Facts,
  ItemRow,
  MunicipalityTag,
  ResidentBadge,
  usePerson,
  useWhen,
} from "./item-parts";
import { useSplit } from "./split";
import { type Body, useDecision } from "./use-decision";

export type PendingPlace = ApiOutputs["moderation"]["queue"]["places"][number];

/** Publish or reject one place; the same bar wherever the place is shown. */
function PlaceDecision({ place, id }: { place: PendingPlace; id: string }) {
  const t = useTranslations("admin");
  const { decide, pending, error } = useDecision<Body<DecidePlaceInput>>(
    (input) => api.moderation.decidePlace(input),
    { queue: "places", id: place.id },
  );
  return (
    <DecisionBar
      id={id}
      subject={place.name}
      pending={pending}
      error={error}
      primary={{
        label: t("publish"),
        onConfirm: () => decide({ placeId: place.id, decision: "publish" }),
      }}
      secondary={{
        label: t("reject"),
        destructive: true,
        note: { min: 10, max: 500 },
        onConfirm: (note) =>
          decide({ placeId: place.id, decision: "reject", note }),
      }}
    />
  );
}

function PlaceFacts({ place }: { place: PendingPlace }) {
  const q = useTranslations("admin.queue");
  return (
    <Facts>
      <Fact label={q("address")}>{place.address}</Fact>
      <Fact label={q("location")}>
        {q(`locationSource.${place.locationSource}`)}
      </Fact>
      <Fact label={q("description")} wide>
        {place.description}
      </Fact>
    </Facts>
  );
}

export function PlaceRow({ place }: { place: PendingPlace }) {
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const map = useMapCopy();
  const mapItem = useMemo(() => placeMapItem(place), [place]);

  return (
    <ItemRow
      titleId={`${id}-title`}
      itemId={place.id}
      title={place.name}
      meta={
        <>
          <MunicipalityTag name={place.municipalityName} />
          {place.categoryName}
          {place.submitterResidentVerified ? <ResidentBadge /> : null}
        </>
      }
      byline={
        <>
          {person("submittedBy", place.submittedBy)}
          {when("receivedAt", place.createdAt)}
        </>
      }
      media={
        <MapPreview
          className="max-w-none"
          item={mapItem}
          label={map.placeAlt(place)}
          title={place.name}
          legend={map.placesLegend([place])}
          anchor={place}
        />
      }
      detail={<PlaceFacts place={place} />}
      decision={<PlaceDecision place={place} id={id} />}
    />
  );
}

/** The place in the list beside the selected one: what it is, where, who sent it and when. */
export function PlaceLine({ place }: { place: PendingPlace }) {
  const split = useSplit();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const q = useTranslations("admin.queue");
  return (
    <DeskLine
      selected={split?.selected === place.id}
      onSelect={() => split?.select(place.id)}
      title={place.name}
      lead={
        <CategoryPin
          icon={place.categoryIcon}
          color={place.categoryColor}
          tile
          className="size-9 rounded-[10px] [&>svg]:size-[18px]"
        />
      }
    >
      <p className="truncate text-[13px] text-muted-foreground">
        {place.municipalityName} · {place.categoryName}
      </p>
      {/* Who and when share the foot, whatever the line holds. */}
      <p className="flex min-w-0 items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span className="truncate">
          {place.submittedBy ?? q("submittedByAnon")}
        </span>
        <time dateTime={place.createdAt} className="shrink-0 tabular-nums">
          {format.relativeTime(new Date(place.createdAt), now)}
        </time>
      </p>
    </DeskLine>
  );
}

/**
 * Everything needed to decide one place, in reading order: what and where it
 * is, who sent it, the facts, the decision while they are in view, and the
 * map last and large, as the evidence it is.
 */
export function PlaceDetail({ place }: { place: PendingPlace }) {
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const map = useMapCopy();
  const mapItem = useMemo(() => placeMapItem(place), [place]);
  return (
    <article aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <h2
          id={`${id}-title`}
          className="text-xl leading-tight font-semibold text-balance"
        >
          {place.name}
        </h2>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <MunicipalityTag name={place.municipalityName} />
          {place.categoryName}
          {place.submitterResidentVerified ? <ResidentBadge /> : null}
        </p>
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted-foreground">
          <span>{person("submittedBy", place.submittedBy)}</span>
          <span>{when("receivedAt", place.createdAt)}</span>
        </p>
      </header>
      <PlaceFacts place={place} />
      <div className="rounded-(--radius-card) bg-muted/60 p-3">
        <PlaceDecision place={place} id={id} />
      </div>
      <MapPreview
        className="max-w-none"
        mapClassName="aspect-[2/1]"
        item={mapItem}
        label={map.placeAlt(place)}
        title={place.name}
        legend={map.placesLegend([place])}
        anchor={place}
      />
    </article>
  );
}
