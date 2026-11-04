"use client";

import type { ApiOutputs, DecideReportInput } from "@ruta/contracts";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { api } from "@/lib/web/api";
import { DecisionBar } from "./decision-bar";
import {
  Fact,
  Facts,
  ItemRow,
  MunicipalityTag,
  usePerson,
  useWhen,
} from "./item-parts";
import { type Body, useDecision } from "./use-decision";

export type PlaceCorrection =
  ApiOutputs["moderation"]["queue"]["reports"][number];

/** A correction a resident asked for on a published place. */
export function ReportRow({ report }: { report: PlaceCorrection }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const { decide, pending, error } = useDecision<Body<DecideReportInput>>(
    (input) => api.moderation.decideReport(input),
    { queue: "reports", id: report.id },
  );

  return (
    <ItemRow
      titleId={`${id}-title`}
      title={report.placeName}
      meta={
        <>
          <MunicipalityTag name={report.municipalityName} />
          {q(`reportReason.${report.reason}`)}
        </>
      }
      byline={
        <>
          {person("reportedBy", report.reportedBy)}
          {when("receivedAt", report.createdAt)}
        </>
      }
      detail={
        report.details ? (
          <Facts>
            <Fact label={q("details")} wide>
              {report.details}
            </Fact>
          </Facts>
        ) : undefined
      }
      decision={
        <DecisionBar
          id={id}
          subject={report.placeName}
          pending={pending}
          error={error}
          primary={{
            label: t("resolve"),
            onConfirm: () =>
              decide({ reportId: report.id, decision: "resolved" }),
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
      }
    />
  );
}
