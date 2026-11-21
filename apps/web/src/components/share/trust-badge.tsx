import { BadgeCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Neighbours vouched for this place: a small sage seal, quieter than the
 * directions button. The label stays short; how many neighbours, and what
 * they vouched for, is the detail on hover or focus, and is read out too.
 */
export function TrustBadge({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // biome-ignore lint/a11y/noNoninteractiveTabindex: focus opens the detail for keyboard users
          tabIndex={0}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--brand)_12%,var(--paper))] pr-3 pl-2 text-[14px] font-medium text-brand outline-offset-2 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <BadgeCheck aria-hidden className="size-4" strokeWidth={2.2} />
          {label}
          <span className="sr-only">. {detail}</span>
        </span>
      </TooltipTrigger>
      {/* The desk's tooltip tokens live under `.admin`; this one sits on the public site. */}
      <TooltipContent className="rounded-lg text-[13px] [--background:var(--paper)] [--foreground:var(--ink)]">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}
