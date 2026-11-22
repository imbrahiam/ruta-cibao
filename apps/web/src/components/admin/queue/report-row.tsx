"use client";

import type { ApiOutputs, DecideReportInput } from "@ruta/contracts";
import { ExternalLink, MapPin, SquarePen } from "lucide-react";
import { useId } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { useDay } from "@/components/admin/use-day";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/web/api";
import { DecisionBar } from "./decision-bar";
import { Chip, ItemRow, useWhen } from "./item-parts";
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

export type PlaceCorrection =
  ApiOutputs["moderation"]["queue"]["reports"][number];

/** Close or discard one correction; the same bar wherever it is shown. */
function ReportDecision({
  report,
  id,
}: {
  report: PlaceCorrection;
  id: string;
}) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const { decide, pending, error } = useDecision<Body<DecideReportInput>>(
    (input) => api.moderation.decideReport(input),
    { queue: "reports", id: report.id },
  );
  return (
    <DecisionBar
      id={id}
      subject={report.placeName}
      pending={pending}
      error={error}
      primary={{
        label: q("closeReport"),
        onConfirm: () => decide({ reportId: report.id, decision: "resolved" }),
      }}
      secondary={{
        label: t("dismiss"),
        note: { min: 0, max: 500 },
        onConfirm: (note) =>
          decide({
            reportId: report.id,
            decision: "dismissed",
            ...(note ? { note } : {}),
          }),
      }}
    />
  );
}

/**
 * A correction a resident asked for on a published place. Read at a glance:
 * the place, what was reported (as chips) and the resident's words, then who
 * (with their photo) and when, beside the decision.
 *
 * Deciding only closes the report; the published place is not changed by it,
 * so the actions say so ("Cerrar reporte"), and the place's public page is one
 * click away to check its current state.
 */
export function ReportRow({ report }: { report: PlaceCorrection }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const contact = useTranslations("admin.contactActions");
  const id = useId();
  const when = useWhen();
  const format = useFormatter();
  // "hace 2 días" stays true while the desk is open.
  const now = useNow({ updateInterval: 60_000 });

  return (
    <ItemRow
      titleId={`${id}-title`}
      title={report.placeName}
      meta={
        <span className="flex flex-wrap items-center gap-1.5">
          <Chip className="bg-amber-500/12 text-amber-800 dark:text-amber-300">
            {q(`reportReason.${report.reason}`)}
          </Chip>
          <Chip>
            <MapPin aria-hidden />
            <span className="sr-only">{t("municipality")}: </span>
            {report.municipalityName}
          </Chip>
        </span>
      }
      summary={report.details}
      byline={
        // Who, with their photo, and when under the name: one block.
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <PersonAvatar
            name={report.reportedBy}
            image={report.reportedByImage}
            className="size-8"
            verified={
              report.reporterResidentVerified ? q("residentBadge") : undefined
            }
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium text-foreground">
              {report.reportedBy ?? q("aNeighbour")}
            </span>
            <time
              dateTime={report.createdAt}
              title={when("receivedAt", report.createdAt)}
              className="text-xs text-muted-foreground"
            >
              {format.relativeTime(new Date(report.createdAt), now)}
            </time>
          </span>
        </span>
      }
      aside={
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/s/place/${report.placeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="max-sm:sr-only">{q("viewPlace")}</span>
            <ExternalLink aria-hidden />
            <span className="sr-only">{contact("newTab")}</span>
          </a>
        </Button>
      }
      decision={<ReportDecision report={report} id={id} />}
    />
  );
}

/** The correction in the list: the place and how long ago, then what is wrong with it. */
export function ReportLine({ report }: { report: PlaceCorrection }) {
  const split = useSplit();
  const q = useTranslations("admin.queue");
  return (
    <ReviewLine
      selected={split?.selected === report.id}
      onSelect={() => split?.select(report.id)}
      title={report.placeName}
      end={<Ago iso={report.createdAt} />}
      meta={`${q(`reportReason.${report.reason}`)} · ${report.municipalityName}`}
      lead={
        <PersonAvatar
          name={report.reportedBy}
          image={report.reportedByImage}
          className="size-10"
          verified={
            report.reporterResidentVerified ? q("residentBadge") : undefined
          }
        />
      }
    />
  );
}

/**
 * One correction: which place and what is said to be wrong on top, the
 * resident's words, who and when, and the way to the place's public page to
 * check it. Deciding only closes the report; the place is not changed by it.
 */
export function ReportDetail({ report }: { report: PlaceCorrection }) {
  const id = useId();
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const contact = useTranslations("admin.contactActions");
  const format = useFormatter();
  const day = useDay();
  const received = new Date(report.createdAt);
  return (
    <ReviewSheet
      titleId={`${id}-title`}
      title={report.placeName}
      lead={<GlyphTile icon={SquarePen} large />}
      pills={
        <>
          <Pill tone="amber">{q(`reportReason.${report.reason}`)}</Pill>
          <Pill icon={MapPin}>
            <span className="sr-only">{t("municipality")}: </span>
            {report.municipalityName}
          </Pill>
        </>
      }
      actions={
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/s/place/${report.placeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {q("viewPlace")}
            <ExternalLink aria-hidden />
            <span className="sr-only">{contact("newTab")}</span>
          </a>
        </Button>
      }
      footer={<ReportDecision report={report} id={id} />}
    >
      {report.details ? (
        <Quote label={q("details")}>{report.details}</Quote>
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
      </Ficha>
    </ReviewSheet>
  );
}
