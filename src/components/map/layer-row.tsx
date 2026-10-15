"use client";

import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { Switch } from "@/components/ui/switch";

/**
 * One map layer, on or off.
 *
 * The Google Maps "Capas" pattern: an icon, a name, one line saying what it
 * shows, and a switch at the edge. The toggles this replaces said "on" only
 * through a faint background tint, which nobody reads as state — a switch is
 * the one control whose position *is* its value. The whole row is the label,
 * so the tap target is the row, not the 48 px switch.
 */
export function LayerRow({
  icon: Icon,
  title,
  hint,
  checked,
  onCheckedChange,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Shown under the row while the layer is on — a legend, a link. */
  children?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="rounded-xl transition-colors has-data-checked:bg-accent/40">
      <label
        htmlFor={id}
        className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/70"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-base">{title}</span>
          <span className="block text-muted-foreground text-sm leading-snug">
            {hint}
          </span>
        </span>
        <Switch
          id={id}
          size="lg"
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </label>
      {checked && children ? (
        <div className="px-3 pb-3 pl-[4.25rem]">{children}</div>
      ) : null}
    </div>
  );
}
