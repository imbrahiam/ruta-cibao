"use client";

import type {
  ApiOutputs,
  DecidePublicationInput,
  RemoveTrafficInput,
} from "@ruta/contracts";
import { useId, useMemo } from "react";
import { useTranslations } from "use-intl";
import { api } from "@/lib/web/api";
import { MapPreview } from "../map/map-preview";
import { trafficMapItem } from "../map/queue-items";
import { useMapCopy } from "../map/use-map-copy";
import { StatusIndicator } from "../status-indicator";
import { DecisionBar } from "./decision-bar";
import {
  Fact,
  Facts,
  ItemRow,
  MunicipalityTag,
  ResidentBadge,
  usePerson,
  useWhen,
} from "./item-parts";
import { type Body, useDecision } from "./use-decision";

export type LiveTraffic = ApiOutputs["moderation"]["queue"]["traffic"][number];

const REASON = { min: 10, max: 500 } as const;

/** A traffic report on the map, with its free text held for review. */
export function TrafficRow({ report }: { report: LiveTraffic }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const map = useMapCopy();
  const mapItem = useMemo(() => trafficMapItem(report), [report]);

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
    <ItemRow
      titleId={`${id}-title`}
      itemId={report.id}
      title={report.categoryName}
      meta={
        <>
          <MunicipalityTag name={report.municipalityName} />
          {report.reporterResidentVerified ? <ResidentBadge /> : null}
        </>
      }
      byline={
        <>
          {person("reportedBy", report.reportedBy)}
          {when("receivedAt", report.createdAt)}
          {when("expiresAt", report.expiresAt)}
        </>
      }
      detail={
        <>
          <MapPreview
            item={mapItem}
            label={map.trafficAlt(report)}
            title={report.categoryName}
            legend={map.trafficLegend([report])}
            anchor={report}
          />
          <Facts>
            <Fact label={q("trafficText")} wide>
              {report.description === null ? null : (
                <div className="flex flex-col gap-1">
                  <StatusIndicator
                    tone={
                      report.descriptionModerationStatus === "pending"
                        ? "warning"
                        : report.descriptionModerationStatus === "published"
                          ? "success"
                          : "neutral"
                    }
                    className="text-xs text-muted-foreground"
                  >
                    {q(
                      `trafficTextStatus.${report.descriptionModerationStatus}`,
                    )}
                  </StatusIndicator>
                  {report.description}
                </div>
              )}
            </Fact>
          </Facts>
        </>
      }
      decision={
        <div className="flex flex-col gap-4">
          {reviewText ? (
            <div className="flex flex-col gap-2">
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
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <DecisionBar
              id={`${id}-remove`}
              subject={report.categoryName}
              pending={removal.pending}
              error={removal.error}
              secondary={{
                label: t("remove"),
                destructive: true,
                note: REASON,
                onConfirm: (note) =>
                  removal.decide({ reportId: report.id, note }),
              }}
            />
          </div>
        </div>
      }
    />
  );
}
