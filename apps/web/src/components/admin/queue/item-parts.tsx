"use client";

import { CheckCircle2, CircleDashed, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { Tag } from "@/components/ui/tag";
import { cx } from "@/lib/web/cx";

/**
 * The grid every queue row uses at `md` and up: item, detail, decision. The
 * header row and the rows share it so the columns line up.
 */
export const ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_13rem] md:gap-x-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_16rem]";

/** Column titles. Decorative: every cell names its own fields. */
export function ColumnHeader() {
  const t = useTranslations("admin.queue");
  return (
    <div
      aria-hidden
      className={cx(
        "t-label hidden border-b border-line bg-paper-2 px-5 py-3 text-ink-2 md:grid",
        ROW_GRID,
      )}
    >
      <span>{t("colItem")}</span>
      <span>{t("colDetail")}</span>
      <span>{t("colDecision")}</span>
    </div>
  );
}

/**
 * One item. A card on a phone; on wide screens a row of three columns inside
 * the list's shared surface, so it reads as a table without being one.
 */
export function ItemRow({
  titleId,
  item,
  detail,
  decision,
}: {
  titleId: string;
  item: ReactNode;
  detail: ReactNode;
  decision: ReactNode;
}) {
  return (
    <li
      aria-labelledby={titleId}
      className={cx(
        "flex flex-col gap-5 rounded-card bg-card p-4 shadow-ring md:gap-y-0 md:rounded-none md:bg-transparent md:p-5 md:shadow-none",
        ROW_GRID,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2.5">{item}</div>
      <div className="flex min-w-0 flex-col gap-3">{detail}</div>
      <div className="min-w-0 border-t border-line pt-4 md:border-t-0 md:pt-0">
        {decision}
      </div>
    </li>
  );
}

/** The item's title: data as written, named for the row via `aria-labelledby`. */
export function ItemTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="text-[17px] leading-snug font-medium tracking-[-0.012em] break-words text-ink"
    >
      {children}
    </h2>
  );
}

/** Which municipality an item belongs to: always on show, as text. */
export function MunicipalityTag({ name }: { name: string }) {
  const t = useTranslations("admin");
  return (
    <Tag>
      <MapPin aria-hidden className="size-3" />
      <span className="sr-only">{t("municipality")}: </span>
      {name}
    </Tag>
  );
}

/** Verified or not, in words and an icon, never in colour alone. */
export function ResidentBadge({ verified }: { verified: boolean }) {
  const t = useTranslations("admin.queue");
  return verified ? (
    <Tag tone="success">
      <CheckCircle2 aria-hidden className="size-3" />
      {t("residentBadge")}
    </Tag>
  ) : (
    <Tag>
      <CircleDashed aria-hidden className="size-3" />
      {t("residentNot")}
    </Tag>
  );
}

/** A labelled value inside a detail column. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-3">{children}</dl>;
}

export function Fact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] font-medium text-ink-2">{label}</dt>
      <dd className="t-small text-ink [overflow-wrap:anywhere] whitespace-pre-line">
        {children}
      </dd>
    </div>
  );
}

/** "Recibido el 3 oct 2026 a las 4:05 p. m." from an ISO instant. */
export function useWhen() {
  const format = useFormatter();
  const t = useTranslations("admin.queue");
  return (key: "receivedAt" | "expiresAt", iso: string) => {
    const date = new Date(iso);
    return t(key, {
      date: format.dateTime(date, "short"),
      time: format.dateTime(date, "time"),
    });
  };
}

/** A person's name as the API gave it, or the anonymous wording. */
export function usePerson() {
  const t = useTranslations("admin.queue");
  return (
    named:
      | "submittedBy"
      | "reportedBy"
      | "uploadedBy"
      | "claimedBy"
      | "openedBy",
    name: string | null,
  ) => (name ? t(named, { name }) : t(`${named}Anon`));
}
