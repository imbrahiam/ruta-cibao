"use client";

import { useTranslations } from "next-intl";
import {
  StatusBadge as Badge,
  statusTone,
} from "@/components/ui-patterns/status-badge";

/**
 * Where a case stands, as one chip.
 *
 * A thin wrapper over the shared badge: the case's own words from the
 * catalogue, drawn in the same five tones every other list in the app uses.
 */
export type CaseStatus =
  | "open"
  | "in_review"
  | "answered"
  | "resolved"
  | "rejected";

export function StatusBadge({
  status,
  className,
}: {
  status: CaseStatus;
  className?: string;
}) {
  const t = useTranslations("consultations.statusLabel");

  return (
    <Badge tone={statusTone(status)} label={t(status)} className={className} />
  );
}
