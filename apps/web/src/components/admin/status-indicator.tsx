import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * `danger` is the one tone that changes the pill: a failure or an urgent item
 * has to be seen. Everything else is a neutral pill; the word (and an icon that
 * means the state) carries it, never a coloured dot.
 */
export type StatusTone = "neutral" | "danger";

/** A state as a word in a quiet pill, with an icon that means the state. */
export function StatusIndicator({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: StatusTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      data-slot="status-indicator"
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] leading-none font-medium whitespace-nowrap",
        tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-secondary text-secondary-foreground",
        Icon && "pl-2",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      {children}
    </span>
  );
}
