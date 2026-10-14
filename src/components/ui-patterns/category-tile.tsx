"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A category as a big soft tile: the picture inside, the word underneath.
 *
 * Larger than a chip on purpose. A pictogram the size of a thumb is something
 * a person who reads slowly can choose by, and the word under it confirms the
 * choice rather than carrying it. The selected tile is outlined in ink and
 * marked with a dot under its word, so the state is a shape as well as a tone.
 */
export function CategoryTile({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="group flex w-[5.75rem] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span
        className={cn(
          "flex h-[4.75rem] w-full items-center justify-center rounded-2xl bg-secondary transition-colors",
          active
            ? "bg-background ring-2 ring-foreground ring-inset"
            : "group-hover:bg-foreground/[0.07]",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "line-clamp-2 text-balance text-center text-sm leading-tight",
          active
            ? "font-semibold text-foreground"
            : "font-medium text-foreground/80",
        )}
      >
        {label}
      </span>
      <span
        aria-hidden
        className={cn(
          "-mt-0.5 size-1 rounded-full",
          active ? "bg-foreground" : "bg-transparent",
        )}
      />
    </button>
  );
}
