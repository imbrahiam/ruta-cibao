"use client";

import type {
  ApiOutputs,
  DecidePublicationInput,
  RemoveTrafficInput,
} from "@ruta/contracts";
import { Clock, EyeOff, ShieldCheck } from "lucide-react";
import { useId, useMemo } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { api } from "@/lib/web/api";
import { MapPreview } from "../map/map-preview";
import { trafficMapItem } from "../map/queue-items";
import { useMapCopy } from "../map/use-map-copy";
import { StatusIndicator } from "../status-indicator";
import { DecisionBar } from "./decision-bar";
import { ItemRow, MunicipalityTag, ResidentBadge, useWhen } from "./item-parts";
import { PersonAvatar } from "./person-avatar";
import { useSplit } from "./split";
import { type Body, useDecision } from "./use-decision";

export type LiveTraffic = ApiOutputs["moderation"]["queue"]["traffic"][number];

const REASON = { min: 10, max: 500 } as const;

/** "Vía bloqueada · 399 m": what the report costs a driver, and how far. */
function useImpact() {
  const a = useTranslations("admin");
  const format = useFormatter();
  return (report: LiveTraffic) => {
    const severity = report.severity ? a(report.severity) : null;
    return [
      // A category named after its impact ("Vía bloqueada") says it already.
      severity === report.categoryName ? null : severity,
      report.lengthMeters === null
        ? null
        : format.number(report.lengthMeters, {
            style: "unit",
            unit: "meter",
            maximumFractionDigits: 0,
          }),
    ].filter((part) => part !== null);
  };
}

/** When the report leaves the map: "Vence hoy, 6:30 p. m." the same day. */
function useExpiry() {
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const when = useWhen();
  return (iso: string) => {
    const date = new Date(iso);
    return date.toDateString() === now.toDateString()
      ? q("expiresToday", { time: format.dateTime(date, "time") })
      : when("expiresAt", iso);
  };
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

/** Who reported it, as a person: face, name and their verification together. */
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
      />
      <span
        className={cn(
          "truncate",
          size === "md" ? "font-medium" : "text-foreground/80",
        )}
      >
        {report.reportedBy ?? q("aNeighbour")}
      </span>
      {report.reporterResidentVerified ? (
        size === "md" ? (
          <ResidentBadge />
        ) : (
          <ShieldCheck
            role="img"
            aria-label={q("residentBadge")}
            className="size-3.5 shrink-0 text-foreground"
          />
        )
      ) : null}
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
  const impact = useImpact();
  const expiry = useExpiry();
  const decisions = useTrafficDecisions(report);

  return (
    <ItemRow
      titleId={`${id}-title`}
      itemId={report.id}
      title={report.categoryName}
      meta={
        <>
          <MunicipalityTag name={report.municipalityName} />
          {impact(report).map((part) => (
            <span key={part}>{part}</span>
          ))}
        </>
      }
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
          <span>{expiry(report.expiresAt)}</span>
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
  const impact = useImpact();
  const expiry = useExpiry();
  const selected = split?.selected === report.id;
  return (
    <li
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors",
        selected
          ? "bg-muted shadow-[inset_3px_0_0_var(--primary)]"
          : "hover:bg-accent/70",
      )}
    >
      <button
        type="button"
        onClick={() => split?.select(report.id)}
        className="truncate text-left text-[15px] leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
      >
        {report.categoryName}
      </button>
      <p className="truncate text-[13px] text-muted-foreground">
        {[report.municipalityName, ...impact(report)].join(" · ")}
      </p>
      <TextState report={report} />
      {report.description ? (
        <p className="line-clamp-2 text-sm text-pretty break-words">
          {report.description}
        </p>
      ) : null}
      <div className="mt-1 flex min-w-0 items-center justify-between gap-3 text-[13px]">
        <Reporter report={report} />
        <span className="shrink-0 text-muted-foreground">
          {expiry(report.expiresAt)}
        </span>
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
  const impact = useImpact();
  const expiry = useExpiry();
  const map = useMapCopy();
  const mapItem = useMemo(() => trafficMapItem(report), [report]);
  const decisions = useTrafficDecisions(report);
  const subtitle = [report.municipalityName, ...impact(report)].join(" · ");

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
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <p className="text-sm font-medium">{expiry(report.expiresAt)}</p>
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
