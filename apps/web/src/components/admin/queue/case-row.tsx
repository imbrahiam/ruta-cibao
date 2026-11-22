"use client";

import type { ApiOutputs, DecidePublicationInput } from "@ruta/contracts";
import {
  ArrowRight,
  Clock,
  Eye,
  MapPin,
  MessageCircleMore,
} from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useDay } from "@/components/admin/use-day";
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
import {
  Ago,
  Ficha,
  FichaItem,
  GlyphTile,
  Pill,
  Quote,
  ReviewLine,
  ReviewSheet,
  Sender,
} from "./review-ui";
import { useSplit } from "./split";
import { type Body, useDecision } from "./use-decision";

export type PendingCase =
  ApiOutputs["moderation"]["queue"]["consultations"][number];

/** Publish or hide one consultation (and answer it once public); one bar everywhere. */
function CaseDecision({ item, id }: { item: PendingCase; id: string }) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
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
    <div className="flex flex-wrap items-start gap-2 lg:flex-nowrap lg:justify-end [&>fieldset]:flex-1 lg:[&>fieldset]:flex-none">
      {item.publicationStatus === "published" ? (
        <Button asChild className="flex-1 pointer-coarse:h-11 lg:flex-none">
          <Link href={`/admin/consultations/${item.slug}`}>{t("respond")}</Link>
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
  );
}

/** A consultation waiting to be shown to other residents. */
export function CaseRow({ item }: { item: PendingCase }) {
  const q = useTranslations("admin.queue");
  const id = useId();
  const when = useWhen();
  const person = usePerson();

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
      decision={<CaseDecision item={item} id={id} />}
    />
  );
}

/** The consultation in the list: its title and how long ago, then its topic and town. */
export function CaseLine({ item }: { item: PendingCase }) {
  const split = useSplit();
  const q = useTranslations("admin.queue");
  return (
    <ReviewLine
      selected={split?.selected === item.id}
      onSelect={() => split?.select(item.id)}
      title={item.title}
      end={<Ago iso={item.createdAt} />}
      meta={`${item.categoryName} · ${item.municipalityName}`}
      flag={
        item.publicationStatus === "pending" ? (
          <Pill tone="amber">
            {q(`publicationLabel.${item.publicationStatus}`)}
          </Pill>
        ) : null
      }
      lead={<GlyphTile icon={MessageCircleMore} />}
    />
  );
}

/**
 * One consultation waiting to be public: whether it is shown yet on top, the
 * resident's whole text, who opened it and how many neighbours support it,
 * and the way to its full record.
 */
export function CaseDetail({ item }: { item: PendingCase }) {
  const id = useId();
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const format = useFormatter();
  const day = useDay();
  const received = new Date(item.createdAt);
  return (
    <ReviewSheet
      titleId={`${id}-title`}
      title={item.title}
      lead={<GlyphTile icon={MessageCircleMore} large />}
      pills={
        <>
          <Pill
            tone={item.publicationStatus === "pending" ? "amber" : "brand"}
            icon={item.publicationStatus === "pending" ? Clock : Eye}
          >
            {q(`publicationLabel.${item.publicationStatus}`)}
          </Pill>
          <Pill>{item.categoryName}</Pill>
          <Pill icon={MapPin}>
            <span className="sr-only">{t("municipality")}: </span>
            {item.municipalityName}
          </Pill>
        </>
      }
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/consultations/${item.slug}`}>
            {t("open")}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
      footer={<CaseDecision item={item} id={id} />}
    >
      <Quote label={q("caseBody")}>{item.body}</Quote>
      <Ficha>
        <FichaItem label={q("sheet.sentBy")}>
          <Sender name={item.openedBy} anonymous={q("aNeighbour")} />
        </FichaItem>
        <FichaItem label={q("sheet.received")}>
          {q("untilDate", {
            date: day(received),
            time: format.dateTime(received, "time"),
          })}
        </FichaItem>
        <FichaItem label={q("sheet.support")}>
          {q("supportCount", { count: item.supportCount })}
        </FichaItem>
      </Ficha>
    </ReviewSheet>
  );
}
