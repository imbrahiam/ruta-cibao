"use client";

import { cx } from "@/lib/cx";

/**
 * Two to four mutually exclusive views. A radio group underneath, so arrow
 * keys move between options and a screen reader announces "1 of 3".
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "inline-flex h-10 items-center gap-0.5 rounded-full bg-paper-3 p-1 pointer-coarse:h-12",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a pill-shaped radio; arrow keys and roving focus are handled here
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              const index = options.findIndex((o) => o.value === value);
              const step =
                event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowLeft"
                    ? -1
                    : 0;
              if (!step) return;
              event.preventDefault();
              const next =
                options[(index + step + options.length) % options.length];
              if (next) {
                onChange(next.value);
                const sibling =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    "[role=radio]",
                  )[options.indexOf(next)];
                sibling?.focus();
              }
            }}
            className={cx(
              "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 pb-px text-[14px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 pointer-coarse:h-10",
              selected
                ? "bg-card font-medium text-ink shadow-sm dark:bg-ink-4"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
            {option.count !== undefined && option.count > 0 ? (
              <span className="font-mono text-[12px] text-ink-3 tabular">
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
