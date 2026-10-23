"use client";

import type { ApiOutputs, DecidePlaceInput } from "@ruta/contracts";
import { ExternalLink } from "lucide-react";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { Tag } from "@/components/ui/tag";
import { api } from "@/lib/web/api";
import { DecisionBar } from "./decision-bar";
import {
  Fact,
  Facts,
  ItemRow,
  ItemTitle,
  MunicipalityTag,
  ResidentBadge,
  usePerson,
  useWhen,
} from "./item-parts";
import { type Body, useDecision } from "./use-decision";

export type PendingPlace = ApiOutputs["moderation"]["queue"]["places"][number];

/** A link that opens a coordinate on OpenStreetMap in a new tab. */
export function MapLink({ lat, lng }: { lat: number; lng: number }) {
  const t = useTranslations("admin.queue");
  const href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-sm font-medium text-accent underline underline-offset-2 pointer-coarse:min-h-11"
    >
      {t("openInMaps")}
      <ExternalLink aria-hidden className="size-3.5" />
      <span className="sr-only">{t("newTab")}</span>
    </a>
  );
}

export function PlaceRow({ place }: { place: PendingPlace }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const { decide, pending, error, decided } = useDecision<
    Body<DecidePlaceInput>
  >((input) => api.moderation.decidePlace(input));

  return (
    <ItemRow
      titleId={`${id}-title`}
      item={
        <>
          <ItemTitle id={`${id}-title`}>{place.name}</ItemTitle>
          <div className="flex flex-wrap gap-1.5">
            <MunicipalityTag name={place.municipalityName} />
            <Tag tone="accent">{place.categoryName}</Tag>
          </div>
          <p className="t-small text-ink-2">
            {person("submittedBy", place.submittedBy)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <ResidentBadge verified={place.submitterResidentVerified} />
          </div>
          <p className="t-small text-ink-2">
            {when("receivedAt", place.createdAt)}
          </p>
        </>
      }
      detail={
        <Facts>
          <Fact label={q("address")}>{place.address ?? q("noAddress")}</Fact>
          <Fact label={q("description")}>
            {place.description ?? q("noDescription")}
          </Fact>
          <Fact label={q("coordinates")}>
            <span className="tabular-nums">
              {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
            </span>{" "}
            <span className="text-ink-2">
              ({q(`locationSource.${place.locationSource}`)})
            </span>
            <br />
            <MapLink lat={place.lat} lng={place.lng} />
          </Fact>
        </Facts>
      }
      decision={
        <DecisionBar
          id={id}
          subject={place.name}
          pending={pending}
          error={error}
          decided={decided}
          primary={{
            label: t("publish"),
            onConfirm: () => decide({ placeId: place.id, decision: "publish" }),
          }}
          secondary={{
            label: t("reject"),
            variant: "danger",
            note: { min: 10, max: 500 },
            onConfirm: (note) =>
              decide({ placeId: place.id, decision: "reject", note }),
          }}
        />
      }
    />
  );
}
