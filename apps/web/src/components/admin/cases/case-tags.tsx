"use client";

import { useTranslations } from "use-intl";
import { Tag } from "@/components/ui/tag";

export type CaseStatus =
  | "open"
  | "in_review"
  | "answered"
  | "resolved"
  | "rejected";
export type Publication = "pending" | "published" | "hidden";

export const CASE_STATUSES: readonly CaseStatus[] = [
  "open",
  "in_review",
  "answered",
  "resolved",
  "rejected",
];

const STATUS_TONE = {
  open: "warning",
  in_review: "accent",
  answered: "success",
  resolved: "success",
  rejected: "neutral",
} as const;

/** The workflow state of a case, always as text. */
export function CaseStatusTag({ status }: { status: CaseStatus }) {
  const t = useTranslations("consultations.statusLabel");
  return <Tag tone={STATUS_TONE[status]}>{t(status)}</Tag>;
}

/** Whether neighbours can see the case, as text. */
export function PublicationTag({ status }: { status: Publication }) {
  const t = useTranslations("admin.cases.publication");
  return (
    <Tag
      tone={
        status === "pending"
          ? "warning"
          : status === "hidden"
            ? "danger"
            : "success"
      }
    >
      {t(status)}
    </Tag>
  );
}
