"use client";

import type {
  ApiOutputs,
  DecidePublicationInput,
  RemoveTrafficInput,
} from "@ruta/contracts";
import { Clock, EyeOff, MapPin, MoveHorizontal } from "lucide-react";
import { useId, useMemo } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { CategoryPin } from "@/components/category/category-pin";
import { cn } from "@/lib/utils";
import { api } from "@/lib/web/api";
import { MapPreview } from "../map/map-preview";
import { trafficMapItem } from "../map/queue-items";
import { useMapCopy } from "../map/use-map-copy";
import { StatusIndicator } from "../status-indicator";
import { DecisionBar } from "./decision-bar";
import { ItemRow, useWhen } from "./item-parts";
import { PersonAvatar } from "./person-avatar";
import { useSplit } from "./split";
import { type Body, useDecision } from "./use-decision";

export type LiveTraffic = ApiOutputs["moderation"]["queue"]["traffic"][number];

const REASON = { min: 10, max: 500 } as const;

/** How bad, as a colour the eye finds before reading. */
const SEVERITY_TONE = {
  blocking: "bg-red-500/10 text-red-700 dark:text-red-300",
  partial: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  minor: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
} as const;

function Chip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5 [&>svg]:shrink-0",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * What the report costs a driver, how far and where, as chips: the severity in
 * its colour (left out when the category already names it), the stretch's
 * length, the town.
 */
function ImpactChips({
  report,
  town = true,
}: {
  report: LiveTraffic;
  town?: boolean;
}) {
  const a = useTranslations("admin");
  const format = useFormatter();
  const severity = report.severity ? a(report.severity) : null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {report.severity && severity !== report.categoryName ? (
        <Chip className={SEVERITY_TONE[report.severity]}>{severity}</Chip>
      ) : null}
      {report.lengthMeters !== null ? (
        <Chip className="bg-muted text-foreground/80">
          <MoveHorizontal aria-hidden />
          {format.number(report.lengthMeters, {
            style: "unit",
            unit: "meter",
            maximumFractionDigits: 0,
          })}
        </Chip>
      ) : null}
      {town ? (
        <Chip className="bg-muted text-foreground/80">
          <MapPin aria-hidden />
          {report.municipalityName}
        </Chip>
      ) : null}
    </span>
  );
}

/** The plain words for the expanded map's subtitle and its label. */
function useImpactText() {
  const a = useTranslations("admin");
  const format = useFormatter();
  return (report: LiveTraffic) =>
    [
      report.municipalityName,
      report.severity && a(report.severity) !== report.categoryName
        ? a(report.severity)
        : null,
      report.lengthMeters === null
        ? null
        : format.number(report.lengthMeters, {
            style: "unit",
            unit: "meter",
            maximumFractionDigits: 0,
          }),
    ]
      .filter(Boolean)
      .join(" · ");
}

/** When the report leaves the map: "Hasta 6:30 p. m." the same day. */
function useExpiry() {
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const when = useWhen();
  return (iso: string) => {
    const date = new Date(iso);
    return date.toDateString() === now.toDateString()
      ? q("until", { time: format.dateTime(date, "time") })
      : when("expiresAt", iso);
  };
}

function Expiry({ iso }: { iso: string }) {
  const q = useTranslations("admin.queue");
  const expiry = useExpiry();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
      <Clock aria-hidden className="size-3.5" />
      <span className="sr-only">{q("expiresLabel")}: </span>
      {expiry(iso)}
    </span>
  );
}

/**
 * The text's state, only when it needs a word: a published text is simply
 * shown; one waiting for review or hidden says so.
 */
function TextState({ report }: { report: LiveTraffic }) {
  const q = useTranslations("admin.queue");
  if (report.description === null) return null;
  if (report.descriptionModerationStatus === "published") return null;
  return (
    <StatusIndicator
      icon={report.descriptionModerationStatus === "pending" ? Clock : EyeOff}
    >
      {q(`trafficTextStatus.${report.descriptionModerationStatus}`)}
    </StatusIndicator>
  );
}

/** Who reported it, as a person: their face, verified or not, and their name. */
function Reporter({
  report,
  size = "sm",
}: {
  report: LiveTraffic;
  size?: "sm" | "md";
}) {
  const q = useTranslations("admin.queue");
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <PersonAvatar
        name={report.reportedBy}
        image={report.reportedByImage}
        className={size === "md" ? "size-8" : "size-6"}
        verified={
          report.reporterResidentVerified ? q("residentBadge") : undefined
        }
      />
      <span
        className={cn(
          "truncate",
          size === "md" ? "font-medium" : "text-[13px] text-foreground/80",
        )}
      >
        {report.reportedBy ?? q("aNeighbour")}
      </span>
    </span>
  );
}

/** The two decisions a report can take: its text, then the report itself. */
function useTrafficDecisions(report: LiveTraffic) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  // Reviewing the text keeps the report on the map; removing it takes it off.
  const text = useDecision<Body<DecidePublicationInput>>(
    (input) => api.moderation.decidePublication(input),
    {
      queue: "traffic",
      id: report.id,
      slot: "text",
      patch: (input) => ({ descriptionModerationStatus: input.status }),
    },
  );
  const removal = useDecision<Body<RemoveTrafficInput>>(
    (input) => api.moderation.removeTraffic(input),
    { queue: "traffic", id: report.id, slot: "remove" },
  );
  const reviewText =
    report.descriptionModerationStatus === "pending" &&
    report.description !== null;

  return (
    <div className="flex flex-col gap-4">
      {reviewText ? (
        <DecisionBar
          id={`${id}-text`}
          subject={`${report.categoryName}: ${q("trafficText")}`}
          pending={text.pending}
          error={text.error}
          primary={{
            label: q("publishText"),
            onConfirm: () =>
              text.decide({
                target: { kind: "traffic", ref: report.id },
                status: "published",
              }),
          }}
          secondary={{
            label: q("hideText"),
            note: REASON,
            onConfirm: (reason) =>
              text.decide({
                target: { kind: "traffic", ref: report.id },
                status: "hidden",
                reason,
              }),
          }}
        />
      ) : null}
      <DecisionBar
        id={`${id}-remove`}
        subject={report.categoryName}
        pending={removal.pending}
        error={removal.error}
        secondary={{
          label: t("remove"),
          destructive: true,
          note: REASON,
          onConfirm: (note) => removal.decide({ reportId: report.id, note }),
        }}
      />
    </div>
  );
}

/**
 * A report as a card, for phones and beside the queue map: what happened,
 * where and how bad, the reporter's words, who and until when. The map itself
 * is the queue's (the "Mapa" view), not one per card.
 */
export function TrafficRow({ report }: { report: LiveTraffic }) {
  const id = useId();
  const decisions = useTrafficDecisions(report);

  return (
    <ItemRow
      titleId={`${id}-title`}
      itemId={report.id}
      title={report.categoryName}
      meta={<ImpactChips report={report} />}
      summary={
        report.description === null ? null : (
          <span className="flex flex-col items-start gap-1.5">
            <TextState report={report} />
            {report.description}
          </span>
        )
      }
      byline={
        <>
          <Reporter report={report} />
          <Expiry iso={report.expiresAt} />
        </>
      }
      decision={decisions}
    />
  );
}

/**
 * The report as one line of the list beside the open one, as it reads in the
 * queue: what and where, the words, then who and until when.
 */
export function TrafficLine({ report }: { report: LiveTraffic }) {
  const split = useSplit();
  const selected = split?.selected === report.id;
  return (
    <li
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex gap-3 rounded-lg px-3 py-3 transition-colors",
        selected
          ? "bg-muted shadow-[inset_3px_0_0_var(--primary)]"
          : "hover:bg-accent/70",
      )}
    >
      <CategoryPin
        icon={report.categoryIcon}
        color={report.categoryColor}
        tile
        className="size-9 rounded-[10px] [&>svg]:size-[18px]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <button
            type="button"
            onClick={() => split?.select(report.id)}
            className="truncate text-left text-[15px] leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
          >
            {report.categoryName}
          </button>
          <Expiry iso={report.expiresAt} />
        </div>
        <ImpactChips report={report} />
        <TextState report={report} />
        {report.description ? (
          <p className="line-clamp-2 text-sm text-pretty break-words text-foreground/80">
            {report.description}
          </p>
        ) : null}
        <Reporter report={report} />
      </div>
    </li>
  );
}

/**
 * Everything needed to decide one report, in reading order: what, where and
 * how bad; who reported it and when; their words; the stretch on the map with
 * its coordinates and a way out to Google Maps; the decision last.
 */
export function TrafficDetail({ report }: { report: LiveTraffic }) {
  const id = useId();
  const when = useWhen();
  const impactText = useImpactText();
  const map = useMapCopy();
  const mapItem = useMemo(() => trafficMapItem(report), [report]);
  const decisions = useTrafficDecisions(report);
  const subtitle = impactText(report);

  return (
    <article aria-labelledby={`${id}-title`} className="flex flex-col gap-5">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id={`${id}-title`}
              className="text-xl leading-tight font-semibold"
            >
              {report.categoryName}
            </h2>
            <ImpactChips report={report} />
          </div>
          <Expiry iso={report.expiresAt} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Reporter report={report} size="md" />
          <span className="ml-auto text-[13px] text-muted-foreground">
            {when("receivedAt", report.createdAt)}
          </span>
        </div>
      </header>

      {report.description ? (
        <div className="flex max-w-prose flex-col items-start gap-1.5">
          <TextState report={report} />
          <p className="text-[15px] leading-relaxed text-pretty [overflow-wrap:anywhere]">
            {report.description}
          </p>
        </div>
      ) : null}

      <MapPreview
        className="max-w-none"
        mapClassName="aspect-[16/9]"
        item={mapItem}
        label={map.trafficAlt(report)}
        title={report.categoryName}
        subtitle={subtitle}
        legend={map.trafficLegend([report])}
        anchor={report}
      />

      {/* The end of the review: its own band, after everything to read. */}
      <footer className="rounded-(--radius-card) bg-muted/60 p-4">
        {decisions}
      </footer>
    </article>
  );
}
