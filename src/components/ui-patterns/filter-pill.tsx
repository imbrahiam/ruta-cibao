"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A filter as a soft grey pill; the one that is on is filled with ink.
 *
 * Filled-versus-tinted is a difference in shape and weight, not only in hue,
 * so the selection survives sunlight, a cheap screen and colour blindness.
 */
export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 font-medium text-[15px] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        active
          ? "bg-foreground text-background"
          : "bg-secondary text-foreground hover:bg-foreground/[0.08]",
      )}
    >
      {children}
    </button>
  );
}

/** A row of pills that scrolls sideways on a phone and wraps on a desk. */
export function FilterPillRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </fieldset>
  );
}
