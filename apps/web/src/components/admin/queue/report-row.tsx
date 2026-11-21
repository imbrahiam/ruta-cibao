"use client";

import type { ApiOutputs, DecideReportInput } from "@ruta/contracts";
import { ExternalLink, MapPin } from "lucide-react";
import { useId } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/web/api";
import { DecisionBar } from "./decision-bar";
import { Chip, ItemRow, useWhen } from "./item-parts";
import { PersonAvatar } from "./person-avatar";
import { type Body, useDecision } from "./use-decision";

export type PlaceCorrection =
  ApiOutputs["moderation"]["queue"]["reports"][number];

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
  const { decide, pending, error } = useDecision<Body<DecideReportInput>>(
    (input) => api.moderation.decideReport(input),
    { queue: "reports", id: report.id },
  );

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
