"use client";

import type { ApiOutputs, DecideReportInput } from "@ruta/contracts";
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

export type PlaceCorrection =
  ApiOutputs["moderation"]["queue"]["reports"][number];

/** A correction a resident asked for on a published place. */
export function ReportRow({ report }: { report: PlaceCorrection }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const { decide, pending, error, decided } = useDecision<
    Body<DecideReportInput>
  >((input) => api.moderation.decideReport(input));

  return (
    <ItemRow
      titleId={`${id}-title`}
      item={
        <>
          <ItemTitle id={`${id}-title`}>{report.placeName}</ItemTitle>
          <div className="flex flex-wrap gap-1.5">
            <MunicipalityTag name={report.municipalityName} />
            <Tag tone="warning">{q(`reportReason.${report.reason}`)}</Tag>
          </div>
          <p className="t-small text-ink-2">
            {person("reportedBy", report.reportedBy)}
          </p>
          <p className="t-small text-ink-2">
            {when("receivedAt", report.createdAt)}
          </p>
        </>
      }
      detail={
        <Facts>
          <Fact label={q("place")}>{report.placeName}</Fact>
          <Fact label={q("details")}>{report.details ?? q("noDetails")}</Fact>
        </Facts>
      }
      decision={
        <DecisionBar
          id={id}
          subject={report.placeName}
          pending={pending}
          error={error}
          decided={decided}
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
