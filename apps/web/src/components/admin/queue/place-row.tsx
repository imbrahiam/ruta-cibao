"use client";

import type { ApiOutputs, DecidePlaceInput } from "@ruta/contracts";
import { useId, useMemo } from "react";
import { useTranslations } from "use-intl";
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
import { type Body, useDecision } from "./use-decision";

export type PendingPlace = ApiOutputs["moderation"]["queue"]["places"][number];

export function PlaceRow({ place }: { place: PendingPlace }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const map = useMapCopy();
  const mapItem = useMemo(() => placeMapItem(place), [place]);
  const { decide, pending, error } = useDecision<Body<DecidePlaceInput>>(
    (input) => api.moderation.decidePlace(input),
    { queue: "places", id: place.id },
  );

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
      detail={
        // The map and the facts sit side by side when the row is wide enough
        // (not the window: beside the queue map the row is a narrow column).
        <div className="grid gap-5 @2xl/item:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] @2xl/item:items-start">
          <MapPreview
            className="max-w-none"
            item={mapItem}
            label={map.placeAlt(place)}
            title={place.name}
            legend={map.placesLegend([place])}
            anchor={place}
          />
          <Facts>
            <Fact label={q("address")}>{place.address}</Fact>
            <Fact label={q("location")}>
              {q(`locationSource.${place.locationSource}`)}
            </Fact>
            <Fact label={q("description")} wide>
              {place.description}
            </Fact>
          </Facts>
        </div>
      }
      decision={
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
      }
    />
  );
}
