import { useTranslations } from "next-intl";
import { Tag } from "@/components/ui/tag";

type Status = "open" | "in_review" | "answered" | "resolved" | "rejected";

const TONES: Record<
  Status,
  "neutral" | "warning" | "accent" | "success" | "danger"
> = {
  open: "neutral",
  in_review: "warning",
  answered: "accent",
  resolved: "success",
  rejected: "danger",
};

/** Where a case stands, in the words the catalogue uses for notifications too. */
export function StatusTag({ status }: { status: Status }) {
  const t = useTranslations("consultations.statusLabels");
  return <Tag tone={TONES[status]}>{t(status)}</Tag>;
}
