"use client";

import {
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Eye,
  MessageSquare,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Where a case stands, as one chip.
 *
 * Colour is never the only signal — the state is written out, and each one has
 * its own glyph. Somebody reading this on a phone in sunlight, or with any of
 * the common forms of colour blindness, gets the same answer as everybody else,
 * which the contest's WCAG 2.2 AA requirement asks for and which is simply
 * correct regardless.
 */
export type CaseStatus =
  | "open"
  | "in_review"
  | "answered"
  | "resolved"
  | "rejected";

const APPEARANCE: Record<CaseStatus, { icon: typeof Eye; className: string }> =
  {
    open: {
      icon: CircleDashed,
      className: "border-amber-500/40 bg-amber-500/10 text-amber-700",
    },
    in_review: {
      icon: Eye,
      className: "border-sky-500/40 bg-sky-500/10 text-sky-700",
    },
    answered: {
      icon: MessageSquare,
      className: "border-violet-500/40 bg-violet-500/10 text-violet-700",
    },
    resolved: {
      icon: CircleCheck,
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
    },
    rejected: {
      icon: CircleSlash,
      className: "border-muted-foreground/30 bg-muted text-muted-foreground",
    },
  };

export function StatusBadge({
  status,
  className,
}: {
  status: CaseStatus;
  className?: string;
}) {
  const t = useTranslations("consultations.statusLabel");
  const { icon: Icon, className: tone } = APPEARANCE[status];

  return (
    <Badge variant="outline" className={cn(tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(status)}
    </Badge>
  );
}
