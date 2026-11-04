import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "info"
  | "brand"
  | "warning"
  | "success"
  | "danger";

const DOT: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-info",
  brand: "bg-primary",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-destructive",
};

/**
 * A status as a dot and a word. The word carries the meaning; the dot only
 * sets the tone, so state is never signalled by colour alone.
 */
export function StatusIndicator({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-slot="status-indicator"
      className={cn(
        "inline-flex items-center gap-2 text-sm whitespace-nowrap",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", DOT[tone])}
      />
      {children}
    </span>
  );
}
