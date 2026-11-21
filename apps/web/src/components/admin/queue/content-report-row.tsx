"use client";

import type { ApiOutputs, DecideContentReportInput } from "@ruta/contracts";
import { TriangleAlert } from "lucide-react";
import { useId } from "react";
import { useTranslations } from "use-intl";
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
  const { decide, pending, error } = useDecision<
    Body<DecideContentReportInput>
  >((input) => api.moderation.decideContentReport(input), {
    queue: "content-reports",
    id: report.id,
  });

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
              {q("openReports", { count: report.openReportCount })}{" "}
              {q("decisionClosesAll")}
            </p>
          ) : null}
        </>
      }
      decision={
        <DecisionBar
          id={id}
          subject={title}
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
      }
    />
  );
}
