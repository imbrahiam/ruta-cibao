"use client";

import type { ApiOutputs, DecidePublicationInput } from "@ruta/contracts";
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
      meta={
        <>
          <MunicipalityTag name={item.municipalityName} />
          {item.categoryName}
          <StatusIndicator
            tone={item.publicationStatus === "pending" ? "warning" : "success"}
            className="text-sm text-muted-foreground"
          >
            {q(`publicationLabel.${item.publicationStatus}`)}
          </StatusIndicator>
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
        <div className="flex flex-col gap-2">
          {item.publicationStatus === "published" ? (
            <Button asChild className="pointer-coarse:h-11">
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
