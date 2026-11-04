"use client";

import { useTranslations } from "use-intl";
import {
  StatusIndicator,
  type StatusTone,
} from "@/components/admin/status-indicator";

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

const STATUS_TONE: Record<CaseStatus, StatusTone> = {
  open: "warning",
  in_review: "info",
  answered: "success",
  resolved: "success",
  rejected: "neutral",
};

const PUBLICATION_TONE: Record<Publication, StatusTone> = {
  pending: "warning",
  published: "success",
  hidden: "danger",
};

/** The workflow state of a case: a dot and its word. */
export function CaseStatusTag({ status }: { status: CaseStatus }) {
  const t = useTranslations("consultations.statusLabel");
  return (
    <StatusIndicator tone={STATUS_TONE[status]}>{t(status)}</StatusIndicator>
  );
}

/** Whether neighbours can see the case: a dot and its word. */
export function PublicationTag({ status }: { status: Publication }) {
  const t = useTranslations("admin.cases.publication");
  return (
    <StatusIndicator tone={PUBLICATION_TONE[status]}>
      {t(status)}
    </StatusIndicator>
  );
}
