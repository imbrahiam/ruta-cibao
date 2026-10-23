"use client";

import type { ApiOutputs, DecideContentReportInput } from "@ruta/contracts";
import { Flag } from "lucide-react";
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
  usePerson,
  useWhen,
} from "./item-parts";
import { type Body, useDecision } from "./use-decision";

export type ContentReport =
  ApiOutputs["moderation"]["queue"]["contentReports"][number];

const REASON = { min: 10, max: 500 } as const;

/** A resident's report about published content, to be actioned or dismissed. */
export function ContentReportRow({ report }: { report: ContentReport }) {
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const { decide, pending, error, decided } = useDecision<
    Body<DecideContentReportInput>
  >((input) => api.moderation.decideContentReport(input));

  const title = report.subjectTitle ?? q("untitled");

  return (
    <ItemRow
      titleId={`${id}-title`}
      item={
        <>
          <ItemTitle id={`${id}-title`}>{title}</ItemTitle>
          <div className="flex flex-wrap gap-1.5">
            <MunicipalityTag name={report.municipalityName} />
            <Tag tone="accent">{q(`subjectKind.${report.subject.kind}`)}</Tag>
            {report.priority ? (
              <Tag tone="danger">
                <Flag aria-hidden className="size-3" />
                {q("priority")}
              </Tag>
            ) : null}
          </div>
          {report.priority ? (
            <p className="t-small text-ink-2">{q("priorityHint")}</p>
          ) : null}
          <p className="t-small text-ink-2">
            {person("reportedBy", report.reportedBy)}
          </p>
          <p className="t-small text-ink-2">
            {when("receivedAt", report.createdAt)}
          </p>
        </>
      }
      detail={
        <>
          <Facts>
            <Fact label={q("reportReasonLabel")}>
              {q(`contentReason.${report.reason}`)}
            </Fact>
            <Fact label={q("details")}>{report.details ?? q("noDetails")}</Fact>
            <Fact label={q("reportedContent")}>
              {title}
              <br />
              <span className="text-ink-2">
                {report.subjectVisible
                  ? q("subjectVisible")
                  : q("subjectHidden")}
              </span>
            </Fact>
          </Facts>
          <p className="t-small text-ink-2">
            {q("openReports", { count: report.openReportCount })}{" "}
            {q("decisionClosesAll")}
          </p>
        </>
      }
      decision={
        <DecisionBar
          id={id}
          subject={title}
          pending={pending}
          error={error}
          decided={decided}
          primary={{
            label: q("actionContent"),
            variant: "danger",
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
      }
    />
  );
}
