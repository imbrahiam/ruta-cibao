"use client";

import type { ApiOutputs, DecidePublicationInput } from "@ruta/contracts";
import Link from "next/link";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { ButtonLink } from "@/components/ui/button";
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

export type PendingCase =
  ApiOutputs["moderation"]["queue"]["consultations"][number];

/** A consultation waiting to be shown to other residents. */
export function CaseRow({ item }: { item: PendingCase }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();
  const { decide, pending, error, decided } = useDecision<
    Body<DecidePublicationInput>
  >((input) => api.moderation.decidePublication(input));

  return (
    <ItemRow
      titleId={`${id}-title`}
      item={
        <>
          <ItemTitle id={`${id}-title`}>
            <Link
              href={`/admin/consultations/${item.slug}`}
              className="underline-offset-2 hover:underline"
            >
              {item.title}
            </Link>
          </ItemTitle>
          <div className="flex flex-wrap gap-1.5">
            <MunicipalityTag name={item.municipalityName} />
            <Tag tone="accent">{item.categoryName}</Tag>
            <Tag tone="warning">
              {q(`publicationLabel.${item.publicationStatus}`)}
            </Tag>
          </div>
          <p className="t-small text-ink-2">
            {person("openedBy", item.openedBy)}
          </p>
          <p className="t-small text-ink-2">
            {q("supportCount", { count: item.supportCount })}
          </p>
          <p className="t-small text-ink-2">
            {when("receivedAt", item.createdAt)}
          </p>
        </>
      }
      detail={
        <Facts>
          <Fact label={q("caseBody")}>{item.body}</Fact>
        </Facts>
      }
      decision={
        <div className="flex flex-col gap-2.5">
          {item.publicationStatus === "published" ? (
            <ButtonLink
              href={`/admin/consultations/${item.slug}`}
              variant="accent"
              className="min-h-11 w-full sm:w-auto sm:self-start md:min-h-0"
            >
              {t("respond")}
            </ButtonLink>
          ) : null}
          <DecisionBar
            id={id}
            subject={item.title}
            pending={pending}
            error={error}
            decided={decided}
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
              variant: "danger",
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
