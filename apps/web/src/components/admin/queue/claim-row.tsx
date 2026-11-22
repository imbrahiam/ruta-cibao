"use client";

import type { ApiOutputs, DecideClaimInput } from "@ruta/contracts";
import { normalizePhone } from "@ruta/shared/phone";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { type ReactNode, useId, useMemo } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, orpc } from "@/lib/web/api";
import { ContactValue } from "../contact/contact-value";
import { MapPreview } from "../map/map-preview";
import type { MapItem } from "../map/map-types";
import { DecisionBar } from "./decision-bar";
import { ClampedText, DeskLine, LeadImage, useWhen } from "./item-parts";
import { PersonAvatar } from "./person-avatar";
import { useSplit } from "./split";
import { type Body, useDecision } from "./use-decision";

export type PendingClaim = ApiOutputs["moderation"]["queue"]["claims"][number];

/** On a phone: the whole claim as one soft block, decision at the end. */
export function ClaimRow({ claim }: { claim: PendingClaim }) {
  return (
    <li className="rounded-(--radius-card) border bg-card p-4 sm:p-5">
      <ClaimDetail claim={claim} />
    </li>
  );
}

/**
 * The claim as a line of the list beside the open one: business, town, who
 * asks and when. Choosing it opens it on the right.
 */
export function ClaimLine({ claim }: { claim: PendingClaim }) {
  const split = useSplit();
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const q = useTranslations("admin.queue");
  return (
    <DeskLine
      selected={split?.selected === claim.id}
      onSelect={() => split?.select(claim.id)}
      title={claim.placeName}
      lead={
        // One avatar per line: the requester's photo, or their initials.
        <PersonAvatar
          name={claim.claimedBy}
          image={claim.claimedByImage}
          className="size-9"
          verified={
            claim.claimantResidentVerified ? q("residentBadge") : undefined
          }
        />
      }
    >
      <p className="truncate text-[13px] text-muted-foreground">
        {claim.municipalityName}
      </p>
      <p className="flex min-w-0 items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span className="truncate">
          {claim.claimedBy ?? q("claimedByAnon")}
        </span>
        <time dateTime={claim.createdAt} className="shrink-0 tabular-nums">
          {format.relativeTime(new Date(claim.createdAt), now)}
        </time>
      </p>
    </DeskLine>
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
  const when = useWhen();
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
    <article aria-labelledby={`${id}-title`} className="flex flex-col gap-5">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id={`${id}-title`}
              className="text-xl leading-tight font-semibold"
            >
              {claim.placeName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {claim.municipalityName} · {claim.categoryName}
            </p>
          </div>
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
        </div>

        {/* Who asks, as a person: their face, their name, the verification
            that belongs to them; when, quietly at the end. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <PersonAvatar
            name={claim.claimedBy}
            image={claim.claimedByImage}
            className="size-8"
            verified={
              claim.claimantResidentVerified ? q("residentBadge") : undefined
            }
          />
          <span className="font-medium">
            {claim.claimedBy ?? q("claimedByAnon")}
          </span>
          <span className="ml-auto text-[13px] text-muted-foreground">
            {when("receivedAt", claim.createdAt)}
          </span>
        </div>
      </header>

      {/* What to read on the left; where the place is, as a supporting
          preview, on the right once the pane is wide enough. */}
      <div className="@container flex flex-col gap-5">
        {/* The statement keeps to the left, well apart from the map, which
            is a short strip: the whole claim fits the pane without scrolling. */}
        <div className="grid gap-6 @lg:grid-cols-[minmax(0,1fr)_minmax(14rem,38%)] @lg:items-start @lg:gap-x-12">
          <div className="flex min-w-0 flex-col gap-5">
            <ClaimSection id={`${id}-statement`} title={q("claimStatement")}>
              <div className="max-w-prose text-[15px] [overflow-wrap:anywhere] whitespace-pre-line">
                <ClampedText>{claim.evidence}</ClampedText>
              </div>
            </ClaimSection>
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

      {/* The end of the review: its own band, after everything to read. A
          decision announces its outcome and the next claim opens. */}
      <footer className="rounded-(--radius-card) bg-muted/60 p-4">
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
      </footer>
    </article>
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
