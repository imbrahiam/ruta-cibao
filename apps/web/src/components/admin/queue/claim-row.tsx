"use client";

import type { ApiOutputs, DecideClaimInput } from "@ruta/contracts";
import { normalizePhone } from "@ruta/shared/phone";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MapPin, Store } from "lucide-react";
import { type ReactNode, useId, useMemo } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useDay } from "@/components/admin/use-day";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, orpc } from "@/lib/web/api";
import { ContactValue } from "../contact/contact-value";
import { MapPreview } from "../map/map-preview";
import type { MapItem } from "../map/map-types";
import { DecisionBar } from "./decision-bar";
import { LeadImage } from "./item-parts";
import { PersonAvatar } from "./person-avatar";
import {
  Ago,
  Ficha,
  FichaItem,
  GlyphTile,
  Pill,
  Quote,
  ReviewLine,
  ReviewSheet,
  Sender,
} from "./review-ui";
import { useSplit } from "./split";
import { type Body, useDecision } from "./use-decision";

export type PendingClaim = ApiOutputs["moderation"]["queue"]["claims"][number];

/** On a phone: the whole claim as one soft block, decision at the end. */
export function ClaimRow({ claim }: { claim: PendingClaim }) {
  return (
    <li className="px-4 py-5 sm:px-5">
      <ClaimDetail claim={claim} />
    </li>
  );
}

/** The claim in the list: the business and how long ago, then who asks and where. */
export function ClaimLine({ claim }: { claim: PendingClaim }) {
  const split = useSplit();
  const q = useTranslations("admin.queue");
  return (
    <ReviewLine
      selected={split?.selected === claim.id}
      onSelect={() => split?.select(claim.id)}
      title={claim.placeName}
      end={<Ago iso={claim.createdAt} />}
      meta={`${claim.claimedBy ?? q("aNeighbour")} · ${claim.municipalityName}`}
      lead={
        <PersonAvatar
          name={claim.claimedBy}
          image={claim.claimedByImage}
          className="size-10"
          verified={
            claim.claimantResidentVerified ? q("residentBadge") : undefined
          }
        />
      }
    />
  );
}

/**
 * Everything needed to decide one claim, in reading order:
 * - which business: name, town and category, its map and its public page;
 * - who asks: avatar, name, whether they are a verified resident, and when;
 * - what they say;
 * - what would change: each published value beside the proposed one;
 * - the decision, last, so it is reached after the evidence.
 */
export function ClaimDetail({ claim }: { claim: PendingClaim }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const contact = useTranslations("admin.contactActions");
  const id = useId();
  const format = useFormatter();
  const day = useDay();
  const received = new Date(claim.createdAt);
  const { decide, pending, error } = useDecision<Body<DecideClaimInput>>(
    (input) => api.moderation.decideClaim(input),
    { queue: "claims", id: claim.id },
  );

  // Where the place is and what it already publishes: read for the open
  // claim only, from the same public endpoints the app uses.
  const place = useQuery(
    orpc.places.detail.queryOptions({ input: { slug: claim.placeSlug } }),
  );
  const current = useQuery(
    orpc.businesses.claimState.queryOptions({
      input: { placeId: claim.placeId },
    }),
  );

  const mapItem = useMemo<MapItem | null>(
    () =>
      place.data
        ? {
            kind: "place",
            id: claim.placeId,
            label: claim.placeName,
            lat: place.data.location.lat,
            lng: place.data.location.lng,
            icon: place.data.category.icon,
            color: place.data.category.color,
          }
        : null,
    [place.data, claim.placeId, claim.placeName],
  );

  // The same number twice is one contact, not two rows to compare by eye.
  const phone = claim.contactPhone ? normalizePhone(claim.contactPhone) : null;
  const sameNumber =
    phone !== null &&
    claim.whatsapp !== null &&
    normalizePhone(claim.whatsapp) === phone;

  return (
    <ReviewSheet
      titleId={`${id}-title`}
      title={claim.placeName}
      lead={<GlyphTile icon={Store} large />}
      pills={
        <>
          <Pill>{claim.categoryName}</Pill>
          <Pill icon={MapPin}>
            <span className="sr-only">{t("municipality")}: </span>
            {claim.municipalityName}
          </Pill>
        </>
      }
      actions={
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/s/place/${claim.placeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {q("viewPlace")}
            <ExternalLink aria-hidden />
            <span className="sr-only">{contact("newTab")}</span>
          </a>
        </Button>
      }
      footer={
        <DecisionBar
          id={id}
          subject={claim.placeName}
          pending={pending}
          error={error}
          primary={{
            label: t("approve"),
            onConfirm: () => decide({ claimId: claim.id, decision: "approve" }),
          }}
          secondary={{
            label: t("reject"),
            destructive: true,
            note: { min: 10, max: 500 },
            onConfirm: (note) =>
              decide({ claimId: claim.id, decision: "reject", note }),
          }}
        />
      }
    >
      <Ficha>
        <FichaItem label={q("sheet.requestedBy")}>
          <Sender
            name={claim.claimedBy}
            image={claim.claimedByImage}
            anonymous={q("aNeighbour")}
            verified={
              claim.claimantResidentVerified ? q("residentBadge") : undefined
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

      {/* What to read on the left; where the place is, as a supporting
          preview, on the right once the pane is wide enough. */}
      <div className="@container flex flex-col gap-5">
        {/* The statement keeps to the left, well apart from the map, which
            is a short strip: the whole claim fits the pane without scrolling. */}
        <div className="grid gap-6 @lg:grid-cols-[minmax(0,1fr)_minmax(14rem,38%)] @lg:items-start @lg:gap-x-12">
          <div className="flex min-w-0 flex-col gap-5">
            <Quote label={q("claimStatement")}>{claim.evidence}</Quote>
          </div>

          {mapItem || claim.placeImage ? (
            <div className="flex flex-col gap-3">
              {mapItem && place.data ? (
                <MapPreview
                  className="max-w-none"
                  mapClassName="aspect-auto h-32"
                  facts={false}
                  item={mapItem}
                  label={q("claimMapAlt", { name: claim.placeName })}
                  title={claim.placeName}
                  subtitle={`${claim.municipalityName} · ${claim.categoryName}`}
                  legend={[]}
                  anchor={place.data.location}
                />
              ) : null}
              {claim.placeImage ? (
                <LeadImage
                  placeImage={claim.placeImage}
                  personImage={null}
                  placeName={claim.placeName}
                  large
                />
              ) : null}
            </div>
          ) : null}
        </div>
        {/* Below both, across the pane: a table reads best with its width. */}
        {phone || claim.whatsapp || claim.openingHours ? (
          <ClaimSection
            id={`${id}-proposed`}
            title={q("proposedDetails")}
            hint={q("proposedDetailsHint")}
          >
            <Comparison>
              {sameNumber ? (
                <Change
                  label={q("phoneAndWhatsapp")}
                  control
                  before={current.data?.contactPhone}
                  after={
                    <ContactValue
                      kind="phone"
                      value={claim.contactPhone ?? ""}
                    />
                  }
                />
              ) : (
                <>
                  {claim.contactPhone ? (
                    <Change
                      label={q("contactPhone")}
                      control
                      before={current.data?.contactPhone}
                      after={
                        <ContactValue kind="phone" value={claim.contactPhone} />
                      }
                    />
                  ) : null}
                  {claim.whatsapp ? (
                    <Change
                      label={q("whatsapp")}
                      control
                      before={current.data?.whatsapp}
                      after={
                        <ContactValue kind="whatsapp" value={claim.whatsapp} />
                      }
                    />
                  ) : null}
                </>
              )}
              {claim.openingHours ? (
                <Change
                  label={q("openingHours")}
                  before={keepTimesWhole(current.data?.openingHours)}
                  after={<span>{keepTimesWhole(claim.openingHours)}</span>}
                />
              ) : null}
            </Comparison>
          </ClaimSection>
        ) : null}
      </div>
    </ReviewSheet>
  );
}

/**
 * What approving would change, field by field: a small table of the field,
 * what the place publishes now and what the requester proposes. Every value
 * is the same size and rows line up on their text, so the eye reads across.
 * In a narrow pane the field's name goes above its two values.
 */
function Comparison({ children }: { children: ReactNode }) {
  const q = useTranslations("admin.queue");
  return (
    <div className="@container">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-6 text-sm @lg:grid-cols-[10.5rem_minmax(0,1fr)_minmax(0,1fr)]">
        <div
          aria-hidden
          className="col-span-full grid grid-cols-subgrid pt-2 pb-2 text-xs font-medium text-muted-foreground"
        >
          <span className="hidden @lg:block" />
          <span>{q("published")}</span>
          <span>{q("proposed")}</span>
        </div>
        <dl className="col-span-full grid grid-cols-subgrid">{children}</dl>
      </div>
    </div>
  );
}

/** One field: its name, then the published value (or none) and the proposed. */
function Change({
  label,
  before,
  after,
  control = false,
}: {
  label: string;
  before: string | null | undefined;
  after: ReactNode;
  /** `after` is a 32 px contact button rather than text. */
  control?: boolean;
}) {
  const q = useTranslations("admin.queue");
  return (
    // Text cells start 6 px down, where a 32 px contact button centres its
    // own: first lines meet across the row, however many lines follow.
    <div className="col-span-full grid grid-cols-subgrid items-start border-t border-border/70 py-2">
      <dt className="col-span-full py-1.5 text-muted-foreground @lg:col-span-1">
        {label}
      </dt>
      <dd className="contents">
        <span
          className={cn(
            "min-w-0 py-1.5 [overflow-wrap:anywhere]",
            before
              ? "text-muted-foreground"
              : "text-muted-foreground/80 italic",
          )}
        >
          <span className="sr-only">{q("published")}: </span>
          {before ?? q("nothingPublished")}
        </span>
        <span
          className={cn(
            "min-w-0 text-foreground [overflow-wrap:anywhere]",
            !control && "py-1.5",
          )}
        >
          <span className="sr-only">{q("proposed")}: </span>
          {after}
        </span>
      </dd>
    </div>
  );
}

/** "11:00 a. m." never breaks inside: the time and its "a. m." stay on one line. */
function keepTimesWhole<T extends string | null | undefined>(text: T): T {
  return (text?.replace(/(\d) ([ap])\. m\./g, "$1\u00a0$2.\u00a0m.") ??
    text) as T;
}

/** A titled part of the claim: what the requester says, what would change. */
function ClaimSection({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 id={id} className="text-sm font-semibold">
          {title}
        </h3>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
