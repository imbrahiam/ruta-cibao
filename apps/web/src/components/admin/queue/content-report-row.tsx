"use client";

import type { ApiOutputs, DecideContentReportInput } from "@ruta/contracts";
import { MapPin, MessageSquareWarning, TriangleAlert } from "lucide-react";
import { useId } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useDay } from "@/components/admin/use-day";
import { api } from "@/lib/web/api";
import { StatusIndicator } from "../status-indicator";
import { DecisionBar } from "./decision-bar";
import {
  ClampedText,
  Fact,
  Facts,
  ItemRow,
  MunicipalityTag,
  usePerson,
  useWhen,
} from "./item-parts";
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

export type ContentReport =
  ApiOutputs["moderation"]["queue"]["contentReports"][number];

const REASON = { min: 10, max: 500 } as const;

/** Take the content down or dismiss the report; the same bar wherever it is shown. */
function ContentDecision({
  report,
  id,
}: {
  report: ContentReport;
  id: string;
}) {
  const q = useTranslations("admin.queue");
  const { decide, pending, error } = useDecision<
    Body<DecideContentReportInput>
  >((input) => api.moderation.decideContentReport(input), {
    queue: "content-reports",
    id: report.id,
  });
  return (
    <DecisionBar
      id={id}
      subject={report.subjectTitle ?? q("untitled")}
      pending={pending}
      error={error}
      primary={{
        label: q("actionContent"),
        destructive: true,
        note: REASON,
        onConfirm: (reason) =>
          decide({ reportId: report.id, decision: "actioned", reason }),
      }}
      secondary={{
        label: q("dismissReport"),
        note: REASON,
        onConfirm: (reason) =>
          decide({ reportId: report.id, decision: "dismissed", reason }),
      }}
    />
  );
}

/** A resident's report about published content, to be actioned or dismissed. */
export function ContentReportRow({ report }: { report: ContentReport }) {
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();

  const title = report.subjectTitle ?? q("untitled");

  return (
    <ItemRow
      titleId={`${id}-title`}
      title={title}
      badge={
        report.priority ? (
          <StatusIndicator tone="danger" icon={TriangleAlert}>
            {q("priority")}
          </StatusIndicator>
        ) : null
      }
      meta={
        <>
          <MunicipalityTag name={report.municipalityName} />
          {q(`subjectKind.${report.subject.kind}`)}
        </>
      }
      byline={
        <>
          {person("reportedBy", report.reportedBy)}
          {when("receivedAt", report.createdAt)}
        </>
      }
      detail={
        <>
          <Facts>
            <Fact label={q("reportReasonLabel")}>
              {q(`contentReason.${report.reason}`)}
            </Fact>
            <Fact label={q("reportedContent")}>
              {report.subjectVisible ? q("subjectVisible") : q("subjectHidden")}
            </Fact>
            {report.details ? (
              <Fact label={q("details")} wide>
                <ClampedText>{report.details}</ClampedText>
              </Fact>
            ) : null}
          </Facts>
          {report.openReportCount > 1 ? (
            <p className="text-xs text-muted-foreground">
              {q("openReports", { count: report.openReportCount })}
            </p>
          ) : null}
        </>
      }
      decision={<ContentDecision report={report} id={id} />}
    />
  );
}

/** The report in the list: what was reported and how long ago, then why. */
export function ContentReportLine({ report }: { report: ContentReport }) {
  const split = useSplit();
  const q = useTranslations("admin.queue");
  return (
    <ReviewLine
      selected={split?.selected === report.id}
      onSelect={() => split?.select(report.id)}
      title={report.subjectTitle ?? q("untitled")}
      end={<Ago iso={report.createdAt} />}
      meta={q(`contentReason.${report.reason}`)}
      flag={
        report.priority ? (
          <Pill tone="red" icon={TriangleAlert}>
            {q("priority")}
          </Pill>
        ) : null
      }
      lead={<GlyphTile icon={MessageSquareWarning} />}
    />
  );
}

/**
 * One report about published content: what it is and how urgent on top, the
 * reason in the reporter's words, then the facts that decide it (is it still
 * visible, how many reports are open) and who sent it.
 */
export function ContentReportDetail({ report }: { report: ContentReport }) {
  const id = useId();
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const day = useDay();
  const received = new Date(report.createdAt);
  return (
    <ReviewSheet
      titleId={`${id}-title`}
      title={report.subjectTitle ?? q("untitled")}
      lead={<GlyphTile icon={MessageSquareWarning} large />}
      pills={
        <>
          {report.priority ? (
            <Pill tone="red" icon={TriangleAlert}>
              {q("priority")}
            </Pill>
          ) : null}
          <Pill>{q(`subjectKind.${report.subject.kind}`)}</Pill>
          <Pill icon={MapPin}>
            <span className="sr-only">{t("municipality")}: </span>
            {report.municipalityName}
          </Pill>
        </>
      }
      footer={<ContentDecision report={report} id={id} />}
    >
      {report.details ? (
        <Quote label={q("details")}>{report.details}</Quote>
      ) : null}
      <Ficha>
        <FichaItem label={q("reportReasonLabel")}>
          {q(`contentReason.${report.reason}`)}
        </FichaItem>
        <FichaItem label={q("reportedContent")}>
          {report.subjectVisible ? q("subjectVisible") : q("subjectHidden")}
        </FichaItem>
        <FichaItem label={q("sheet.reportedBy")}>
          <Sender name={report.reportedBy} anonymous={q("aNeighbour")} />
        </FichaItem>
        <FichaItem label={q("sheet.received")}>
          {q("untilDate", {
            date: day(received),
            time: format.dateTime(received, "time"),
          })}
        </FichaItem>
      </Ficha>
      {report.openReportCount > 1 ? (
        <p className="text-[13px] text-muted-foreground">
          {q("openReports", { count: report.openReportCount })}
        </p>
      ) : null}
    </ReviewSheet>
  );
}
