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
import { ClampedText, LeadImage, ResidentBadge, useWhen } from "./item-parts";
import { PersonAvatar } from "./person-avatar";
import { useSplit } from "./split";
import { type Body, useDecision } from "./use-decision";

export type PendingClaim = ApiOutputs["moderation"]["queue"]["claims"][number];

/** On a phone: the whole claim as one soft block, decision at the end. */
export function ClaimRow({ claim }: { claim: PendingClaim }) {
  return (
    <li className="rounded-(--radius-card) bg-muted/45 p-4 sm:p-5">
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
  const selected = split?.selected === claim.id;
  return (
    <li
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        selected
          ? "bg-muted shadow-[inset_3px_0_0_var(--primary)]"
          : "hover:bg-accent/70",
      )}
    >
      {/* One avatar per line: the requester's photo, or their initials. */}
      <PersonAvatar
        name={claim.claimedBy}
        image={claim.claimedByImage}
        className="size-10"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          onClick={() => split?.select(claim.id)}
          className="truncate text-left text-[15px] leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
        >
          {claim.placeName}
        </button>
        <p className="truncate text-[13px] text-muted-foreground">
          {claim.municipalityName}
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="truncate text-foreground/80">
            {claim.claimedBy ?? q("claimedByAnon")}
          </span>
          <time dateTime={claim.createdAt} className="shrink-0 tabular-nums">
            {format.relativeTime(new Date(claim.createdAt), now)}
          </time>
        </p>
      </div>
    </li>
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
          />
          <span className="font-medium">
            {claim.claimedBy ?? q("claimedByAnon")}
          </span>
          {claim.claimantResidentVerified ? <ResidentBadge /> : null}
          <span className="ml-auto text-[13px] text-muted-foreground">
            {when("receivedAt", claim.createdAt)}
          </span>
        </div>
      </header>

      {/* What to read on the left; where the place is, as a supporting
          preview, on the right once the pane is wide enough. */}
      <div className="@container">
        <div className="grid gap-6 @lg:grid-cols-[minmax(0,1fr)_12rem] @lg:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <ClaimSection id={`${id}-statement`} title={q("claimStatement")}>
              <div className="max-w-prose text-[15px] [overflow-wrap:anywhere] whitespace-pre-line">
                <ClampedText>{claim.evidence}</ClampedText>
              </div>
            </ClaimSection>

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
                          before={current.data?.contactPhone}
                          after={
                            <ContactValue
                              kind="phone"
                              value={claim.contactPhone}
                            />
                          }
                        />
                      ) : null}
                      {claim.whatsapp ? (
                        <Change
                          label={q("whatsapp")}
                          before={current.data?.whatsapp}
                          after={
                            <ContactValue
                              kind="whatsapp"
                              value={claim.whatsapp}
                            />
                          }
                        />
                      ) : null}
                    </>
                  )}
                  {claim.openingHours ? (
                    <Change
                      label={q("openingHours")}
                      before={current.data?.openingHours}
                      after={<span>{claim.openingHours}</span>}
                    />
                  ) : null}
                </Comparison>
              </ClaimSection>
            ) : null}
          </div>

          {mapItem || claim.placeImage ? (
            <div className="flex flex-col gap-3">
              {mapItem && place.data ? (
                <MapPreview
                  className="max-w-none"
                  mapClassName="aspect-[4/3]"
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
 * What approving would change, field by field: what the place publishes now
 * beside what the requester proposes. Two labelled columns, no rules.
 */
function Comparison({ children }: { children: ReactNode }) {
  const q = useTranslations("admin.queue");
  return (
    <div className="flex flex-col gap-2 text-[15px]">
      <div
        aria-hidden
        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 text-xs text-muted-foreground"
      >
        <span>{q("published")}</span>
        <span>{q("proposed")}</span>
      </div>
      <dl className="flex flex-col gap-3">{children}</dl>
    </div>
  );
}

/** One field: its name, then the published value (or none) and the proposed. */
function Change({
  label,
  before,
  after,
}: {
  label: string;
  before: string | null | undefined;
  after: ReactNode;
}) {
  const q = useTranslations("admin.queue");
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-foreground/80">{label}</dt>
      <dd className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-4">
        <span
          className={
            before
              ? "text-muted-foreground"
              : "text-sm text-muted-foreground/80 italic"
          }
        >
          <span className="sr-only">{q("published")}: </span>
          {before ?? q("nothingPublished")}
        </span>
        <span className="min-w-0">
          <span className="sr-only">{q("proposed")}: </span>
          {after}
        </span>
      </dd>
    </div>
  );
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
    <section aria-labelledby={id} className="flex flex-col gap-2">
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
