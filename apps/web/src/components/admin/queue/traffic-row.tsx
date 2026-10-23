"use client";

import type {
  ApiOutputs,
  DecidePublicationInput,
  RemoveTrafficInput,
} from "@ruta/contracts";
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
  ResidentBadge,
  usePerson,
  useWhen,
} from "./item-parts";
import { MapLink } from "./place-row";
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

  const text = useDecision<Body<DecidePublicationInput>>((input) =>
    api.moderation.decidePublication(input),
  );
  const removal = useDecision<Body<RemoveTrafficInput>>((input) =>
    api.moderation.removeTraffic(input),
  );

  const reviewText =
    report.descriptionModerationStatus === "pending" &&
    report.description !== null;

  return (
    <ItemRow
      titleId={`${id}-title`}
      item={
        <>
          <ItemTitle id={`${id}-title`}>{report.categoryName}</ItemTitle>
          <div className="flex flex-wrap gap-1.5">
            <MunicipalityTag name={report.municipalityName} />
          </div>
          <p className="t-small text-ink-2">
            {person("reportedBy", report.reportedBy)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <ResidentBadge verified={report.reporterResidentVerified} />
          </div>
          <p className="t-small text-ink-2">
            {when("receivedAt", report.createdAt)}
          </p>
          <p className="t-small text-ink-2">
            {when("expiresAt", report.expiresAt)}
          </p>
        </>
      }
      detail={
        <Facts>
          <Fact label={q("trafficText")}>
            {report.description === null ? (
              q("noText")
            ) : (
              <>
                <Tag
                  tone={
                    report.descriptionModerationStatus === "pending"
                      ? "warning"
                      : report.descriptionModerationStatus === "published"
                        ? "success"
                        : "neutral"
                  }
                >
                  {q(`trafficTextStatus.${report.descriptionModerationStatus}`)}
                </Tag>
                <br />
                {report.description}
              </>
            )}
          </Fact>
          <Fact label={q("coordinates")}>
            <span className="tabular-nums">
              {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
            </span>
            <br />
            <MapLink lat={report.lat} lng={report.lng} />
          </Fact>
        </Facts>
      }
      decision={
        <div className="flex flex-col gap-5">
          {reviewText ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[13px] font-medium text-ink-2">
                {q("trafficText")}
              </p>
              <DecisionBar
                id={`${id}-text`}
                subject={`${report.categoryName}: ${q("trafficText")}`}
                pending={text.pending}
                error={text.error}
                decided={text.decided}
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
          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] font-medium text-ink-2">
              {q("removeNotice")}
            </p>
            <DecisionBar
              id={`${id}-remove`}
              subject={report.categoryName}
              pending={removal.pending}
              error={removal.error}
              decided={removal.decided}
              secondary={{
                label: t("remove"),
                variant: "danger",
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
