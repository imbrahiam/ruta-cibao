"use client";

import type { ApiOutputs, DecidePlaceInput } from "@ruta/contracts";
import { BadgeCheck, MapPin } from "lucide-react";
import { useId, useMemo } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useDay } from "@/components/admin/use-day";
import { CategoryPin } from "@/components/category/category-pin";
import { api } from "@/lib/web/api";
import { MapPreview } from "../map/map-preview";
import { placeMapItem } from "../map/queue-items";
import { useMapCopy } from "../map/use-map-copy";
import { DecisionBar } from "./decision-bar";
import {
  Fact,
  Facts,
  ItemRow,
  MunicipalityTag,
  ResidentBadge,
  usePerson,
  useWhen,
} from "./item-parts";
import {
  Ago,
  Ficha,
  FichaItem,
  Pill,
  Quote,
  ReviewLine,
  ReviewSheet,
  Sender,
} from "./review-ui";
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

/** The place in the list: its name and how long ago, then where and what kind. */
export function PlaceLine({ place }: { place: PendingPlace }) {
  const split = useSplit();
  const q = useTranslations("admin.queue");
  return (
    <ReviewLine
      selected={split?.selected === place.id}
      onSelect={() => split?.select(place.id)}
      title={place.name}
      end={<Ago iso={place.createdAt} />}
      meta={`${place.municipalityName} · ${place.categoryName}`}
      flag={
        place.submitterResidentVerified ? (
          <BadgeCheck
            role="img"
            aria-label={q("residentBadge")}
            className="size-4 shrink-0 text-primary"
          />
        ) : null
      }
      lead={
        <CategoryPin
          icon={place.categoryIcon}
          color={place.categoryColor}
          tile
          className="size-10 rounded-[10px] [&>svg]:size-5"
        />
      }
    />
  );
}

/**
 * One place to decide: what it is on top, where it is on the map (the
 * evidence, so it comes first and large), then what the sender said about it
 * and who they are, and the decision pinned to the foot.
 */
export function PlaceDetail({ place }: { place: PendingPlace }) {
  const id = useId();
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const day = useDay();
  const map = useMapCopy();
  const mapItem = useMemo(() => placeMapItem(place), [place]);
  const received = new Date(place.createdAt);
  return (
    <ReviewSheet
      titleId={`${id}-title`}
      title={place.name}
      lead={
        <CategoryPin
          icon={place.categoryIcon}
          color={place.categoryColor}
          tile
          className="size-12 rounded-xl [&>svg]:size-6"
        />
      }
      pills={
        <>
          <Pill>{place.categoryName}</Pill>
          <Pill icon={MapPin}>
            <span className="sr-only">{t("municipality")}: </span>
            {place.municipalityName}
          </Pill>
        </>
      }
      footer={<PlaceDecision place={place} id={id} />}
    >
      <MapPreview
        className="max-w-none"
        mapClassName="aspect-[21/9] rounded-xl"
        item={mapItem}
        label={map.placeAlt(place)}
        title={place.name}
        legend={map.placesLegend([place])}
        anchor={place}
      />
      {place.description ? (
        <Quote label={q("description")}>{place.description}</Quote>
      ) : null}
      <Ficha>
        <FichaItem label={q("address")}>{place.address}</FichaItem>
        <FichaItem label={q("location")}>
          {q(`locationSource.${place.locationSource}`)}
        </FichaItem>
        <FichaItem label={q("sheet.sentBy")}>
          <Sender
            name={place.submittedBy}
            anonymous={q("aNeighbour")}
            verified={
              place.submitterResidentVerified ? q("residentBadge") : undefined
            }
          />
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
