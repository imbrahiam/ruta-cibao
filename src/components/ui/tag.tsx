import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Mono uppercase label in a pill: eyebrows, statuses, counts. */
export function Tag({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "ink";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "t-label inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 pb-px whitespace-nowrap",
        tone === "neutral" && "bg-paper-3 text-ink-2",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "success" &&
          "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[color-mix(in_srgb,var(--success)_80%,var(--ink))]",
        tone === "warning" &&
          "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[color-mix(in_srgb,var(--warning)_75%,var(--ink))]",
        tone === "danger" &&
          "bg-[color-mix(in_srgb,var(--danger)_13%,transparent)] text-[color-mix(in_srgb,var(--danger)_85%,var(--ink))]",
        tone === "ink" && "bg-ink text-paper",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A pressable filter pill. Selected is shown three ways at once (fill, weight
 * and `aria-pressed`) so it never rests on colour alone.
 */
export function Chip({
  selected = false,
  floating = false,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { selected?: boolean; floating?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        "press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 pb-px text-[14px] whitespace-nowrap pointer-coarse:h-11 [&_svg]:size-4 [&_svg]:shrink-0",
        selected
          ? cx("bg-ink font-medium text-paper", floating && "shadow-sm")
          : floating
            ? "glass text-ink-2 hover:text-ink"
            : "bg-card text-ink-2 shadow-ring hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
