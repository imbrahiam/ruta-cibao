"use client";

import type { ApiOutputs, DecidePublicationInput } from "@ruta/contracts";
import { Clock, Eye } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/web/api";
import { StatusIndicator } from "../status-indicator";
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

export type PendingCase =
  ApiOutputs["moderation"]["queue"]["consultations"][number];

/** A consultation waiting to be shown to other residents. */
export function CaseRow({ item }: { item: PendingCase }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const { decide, pending, error } = useDecision<Body<DecidePublicationInput>>(
    (input) => api.moderation.decidePublication(input),
    {
      queue: "consultations",
      id: item.id,
      // Publishing keeps a case that still awaits an answer in the list.
      patch: (input) =>
        input.status === "published" &&
        (item.status === "open" || item.status === "in_review")
          ? { publicationStatus: "published" }
          : undefined,
    },
  );

  return (
    <ItemRow
      titleId={`${id}-title`}
      title={
        <Link
          href={`/admin/consultations/${item.slug}`}
          className="hover:underline"
        >
          {item.title}
        </Link>
      }
      badge={
        <StatusIndicator
          icon={item.publicationStatus === "pending" ? Clock : Eye}
        >
          {q(`publicationLabel.${item.publicationStatus}`)}
        </StatusIndicator>
      }
      meta={
        <>
          <MunicipalityTag name={item.municipalityName} />
          {item.categoryName}
        </>
      }
      byline={
        <>
          {person("openedBy", item.openedBy)}
          {q("supportCount", { count: item.supportCount })}
          {when("receivedAt", item.createdAt)}
        </>
      }
      detail={
        <Facts>
          <Fact label={q("caseBody")} wide>
            {item.body}
          </Fact>
        </Facts>
      }
      decision={
        // One line of actions, as in every other row; on a phone they share
        // the row's width.
        <div className="flex flex-wrap items-start gap-2 lg:flex-nowrap lg:justify-end [&>fieldset]:flex-1 lg:[&>fieldset]:flex-none">
          {item.publicationStatus === "published" ? (
            <Button asChild className="flex-1 pointer-coarse:h-11 lg:flex-none">
              <Link href={`/admin/consultations/${item.slug}`}>
                {t("respond")}
              </Link>
            </Button>
          ) : null}
          <DecisionBar
            id={id}
            subject={item.title}
            pending={pending}
            error={error}
            primary={
              item.publicationStatus === "published"
                ? undefined
                : {
                    label: t("publish"),
                    onConfirm: () =>
                      decide({
                        target: { kind: "consultation", ref: item.id },
                        status: "published",
                      }),
                  }
            }
            secondary={{
              label: q("hideCase"),
              destructive: true,
              note: { min: 10, max: 500 },
              onConfirm: (reason) =>
                decide({
                  target: { kind: "consultation", ref: item.id },
                  status: "hidden",
                  reason,
                }),
            }}
          />
        </div>
      }
    />
  );
}
