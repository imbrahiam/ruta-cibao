"use client";

import {
  CircleCheck,
  CircleDot,
  CircleSlash,
  Clock,
  Eye,
  EyeOff,
  type LucideIcon,
  MessageSquareReply,
  Search,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { StatusIndicator } from "@/components/admin/status-indicator";

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

/** An icon that means each state, beside its word; no colour code. */
const STATUS_ICON: Record<CaseStatus, LucideIcon> = {
  open: CircleDot,
  in_review: Search,
  answered: MessageSquareReply,
  resolved: CircleCheck,
  rejected: CircleSlash,
};

const PUBLICATION_ICON: Record<Publication, LucideIcon> = {
  pending: Clock,
  published: Eye,
  hidden: EyeOff,
};

/** The workflow state of a case: its word in a quiet pill. */
export function CaseStatusTag({ status }: { status: CaseStatus }) {
  const t = useTranslations("consultations.statusLabel");
  return (
    <StatusIndicator icon={STATUS_ICON[status]}>{t(status)}</StatusIndicator>
  );
}

/** Whether neighbours can see the case: its word in a quiet pill. */
export function PublicationTag({ status }: { status: Publication }) {
  const t = useTranslations("admin.cases.publication");
  return (
    <StatusIndicator icon={PUBLICATION_ICON[status]}>
      {t(status)}
    </StatusIndicator>
  );
}
