"use client";

import type { ApiOutputs, DecideReportInput } from "@ruta/contracts";
import { ExternalLink } from "lucide-react";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/web/api";
import { DecisionBar } from "./decision-bar";
import { ItemRow, MunicipalityTag, usePerson, useWhen } from "./item-parts";
import { type Body, useDecision } from "./use-decision";

export type PlaceCorrection =
  ApiOutputs["moderation"]["queue"]["reports"][number];

/**
 * A correction a resident asked for on a published place. Read at a glance:
 * the place, what was reported and the resident's words, then who and when.
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
          <span>{q(`reportReason.${report.reason}`)}</span>
        </>
      }
      summary={report.details}
      byline={
        <>
          {person("reportedBy", report.reportedBy)}
          {when("receivedAt", report.createdAt)}
        </>
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
      decision={
        <DecisionBar
          id={id}
          subject={report.placeName}
          pending={pending}
          error={error}
          primary={{
            label: q("closeReport"),
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
