"use client";

import { cn } from "@/lib/utils";

/**
 * Two to four choices side by side, one of them on.
 *
 * Every option is visible at once, which a dropdown cannot say: somebody who
 * has never used the app sees that Monción and Villa Los Almácigos are also
 * there without opening anything. Buttons with `aria-pressed` rather than a
 * radio group, because with `allowEmpty` the selection can be cleared — the
 * municipality filter is "the whole province" when none is on.
 *
 * Labels may wrap to two lines on a narrow phone; the control grows rather
 * than shrinking the words.
 */
export function Segmented<Value extends string>({
  label,
  options,
  value,
  onChange,
  allowEmpty = false,
  className,
}: {
  /** What the group chooses, for assistive technology. */
  label: string;
  options: readonly { value: Value; label: string }[];
  value: Value | "";
  onChange: (value: Value | "") => void;
  /** Pressing the current option again clears the selection. */
  allowEmpty?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{label}</legend>
      <div className="flex w-full gap-1 rounded-[1.375rem] bg-secondary p-1">
        {options.map((option) => {
          const current = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={current}
              onClick={() =>
                onChange(current && allowEmpty ? "" : option.value)
              }
              className={cn(
                "flex min-h-11 min-w-0 flex-1 items-center justify-center text-balance rounded-[1.125rem] px-2 py-1.5 text-center font-medium text-[15px] leading-tight transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-1",
                current
                  ? "bg-card font-semibold text-foreground ring-1 ring-foreground/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
