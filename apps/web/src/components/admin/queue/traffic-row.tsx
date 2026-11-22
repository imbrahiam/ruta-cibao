"use client";

import type {
  ApiOutputs,
  DecidePublicationInput,
  RemoveTrafficInput,
} from "@ruta/contracts";
import { Clock, EyeOff, MapPin, MoveHorizontal } from "lucide-react";
import { useId, useMemo } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { useDay } from "@/components/admin/use-day";
import { CategoryPin } from "@/components/category/category-pin";
import { cn } from "@/lib/utils";
import { api } from "@/lib/web/api";
import { MapPreview } from "../map/map-preview";
import { trafficMapItem } from "../map/queue-items";
import { useMapCopy } from "../map/use-map-copy";
import { StatusIndicator } from "../status-indicator";
import { DecisionBar } from "./decision-bar";
import { Chip, ItemRow, useWhen } from "./item-parts";
import { PersonAvatar } from "./person-avatar";
import {
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

export type LiveTraffic = ApiOutputs["moderation"]["queue"]["traffic"][number];

const REASON = { min: 10, max: 500 } as const;

/** How bad, as a colour the eye finds before reading. */
const SEVERITY_TONE = {
  blocking: "bg-red-500/10 text-red-700 dark:text-red-300",
  partial: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  minor: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
} as const;

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
  const day = useDay();
  return (iso: string, short = false) => {
    const date = new Date(iso);
    const time = format.dateTime(date, "time");
    const today = date.toDateString() === now.toDateString();
    // The clock beside it already says "until": a narrow line keeps the hour.
    if (short) {
      return today
        ? time
        : q("untilDate", {
            date: day(date),
            time,
          });
    }
    return today ? q("until", { time }) : when("expiresAt", iso);
  };
}

/** `short` where the line is narrow: the day and the hour. */
function Expiry({ iso, short }: { iso: string; short?: boolean }) {
  const q = useTranslations("admin.queue");
  const expiry = useExpiry();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
      <Clock aria-hidden className="size-3.5" />
      <span className="sr-only">{q("expiresLabel")}: </span>
      {expiry(iso, short)}
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
      byline={<Reporter report={report} />}
      // On the title's line, at its end, as in the list beside the open
      // report; the byline below keeps its room for the decision.
      badge={
        <span className="ml-auto">
          <Expiry iso={report.expiresAt} short />
        </span>
      }
      decision={decisions}
    />
  );
}

const SEVERITY_PILL = {
  blocking: "red",
  partial: "amber",
  minor: "blue",
} as const;

/** The report in the list: what happened and until when, then where and how bad. */
export function TrafficLine({ report }: { report: LiveTraffic }) {
  const split = useSplit();
  const a = useTranslations("admin");
  const severity = report.severity ? a(report.severity) : null;
  return (
    <ReviewLine
      selected={split?.selected === report.id}
      onSelect={() => split?.select(report.id)}
      title={report.categoryName}
      end={<Expiry iso={report.expiresAt} short />}
      meta={report.description ?? report.municipalityName}
      flag={
        report.severity && severity !== report.categoryName ? (
          <Pill tone={SEVERITY_PILL[report.severity]}>{severity}</Pill>
        ) : null
      }
      lead={
        <CategoryPin
          icon={report.categoryIcon}
          color={report.categoryColor}
          tile
          className="size-10 rounded-[10px] [&>svg]:size-5"
        />
      }
    />
  );
}

/**
 * One live report: how bad and where on top, the stretch on a large map, the
 * reporter's words, then who, since when and until when, and what can be done
 * about it pinned to the foot.
 */
export function TrafficDetail({ report }: { report: LiveTraffic }) {
  const id = useId();
  const a = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const day = useDay();
  const expiry = useExpiry();
  const impactText = useImpactText();
  const map = useMapCopy();
  const mapItem = useMemo(() => trafficMapItem(report), [report]);
  const decisions = useTrafficDecisions(report);
  const severity = report.severity ? a(report.severity) : null;
  const received = new Date(report.createdAt);

  return (
    <ReviewSheet
      titleId={`${id}-title`}
      title={report.categoryName}
      lead={
        <CategoryPin
          icon={report.categoryIcon}
          color={report.categoryColor}
          tile
          className="size-12 rounded-xl [&>svg]:size-6"
        />
      }
      pills={
        <>
          {report.severity && severity !== report.categoryName ? (
            <Pill tone={SEVERITY_PILL[report.severity]}>{severity}</Pill>
          ) : null}
          <Pill icon={MapPin}>
            <span className="sr-only">{a("municipality")}: </span>
            {report.municipalityName}
          </Pill>
          <Pill icon={Clock}>{expiry(report.expiresAt)}</Pill>
        </>
      }
      footer={decisions}
    >
      <MapPreview
        className="max-w-none"
        mapClassName="aspect-[21/9] rounded-xl"
        item={mapItem}
        label={map.trafficAlt(report)}
        title={report.categoryName}
        subtitle={impactText(report)}
        legend={map.trafficLegend([report])}
        anchor={report}
      />
      {report.description ? (
        <Quote label={q("trafficText")} state={<TextState report={report} />}>
          {report.description}
        </Quote>
      ) : null}
      <Ficha>
        <FichaItem label={q("sheet.reportedBy")}>
          <Sender
            name={report.reportedBy}
            image={report.reportedByImage}
            anonymous={q("aNeighbour")}
            verified={
              report.reporterResidentVerified ? q("residentBadge") : undefined
            }
          />
        </FichaItem>
        <FichaItem label={q("sheet.received")}>
          {q("untilDate", {
            date: day(received),
            time: format.dateTime(received, "time"),
          })}
        </FichaItem>
        <FichaItem label={q("sheet.stretch")}>
          {report.lengthMeters === null
            ? null
            : format.number(report.lengthMeters, {
                style: "unit",
                unit: "meter",
                maximumFractionDigits: 0,
              })}
        </FichaItem>
      </Ficha>
    </ReviewSheet>
  );
}
