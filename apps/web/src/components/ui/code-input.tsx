"use client";

import { type ComponentProps, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A one-time code field: one real input (so paste, autofill from SMS or
 * email, and screen readers work as usual) drawn as fixed digit slots.
 *
 * Each slot is one tabular digit wide, so the empty dot sits exactly where
 * its number will land and nothing shifts as the code is typed. The caret
 * shows in the slot that takes the next digit; it blinks only when motion is
 * allowed.
 */
export function CodeInput({
  value,
  onValueChange,
  length = 6,
  surface = "desk",
  className,
  onFocus,
  onBlur,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "maxLength"> & {
  value: string;
  onValueChange: (value: string) => void;
  length?: number;
  /** The desk's shadcn field, or the public site's (`site/field`). */
  surface?: "desk" | "site";
}) {
  const [focused, setFocused] = useState(false);
  const next = Math.min(value.length, length - 1);
  const full = value.length >= length;

  return (
    <div
      data-slot="code-input"
      className={cn(
        "relative h-14 w-full transition-[color,box-shadow] has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
        surface === "desk"
          ? [
              "rounded-(--radius-field) border border-input bg-(--field-background) shadow-(--shadow-control)",
              "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[1.5px] has-[input:focus-visible]:ring-ring/40",
              "has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-destructive/20",
            ]
          : [
              "rounded-input bg-card text-ink shadow-ring duration-150",
              "has-[input:focus]:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]",
              "has-[input[aria-invalid=true]]:shadow-[0_0_0_1px_var(--danger)]",
            ],
        className,
      )}
    >
      <input
        {...props}
        value={value}
        maxLength={length}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`\\d{${length}}`}
        spellCheck={false}
        // The text is drawn by the slots; the real one stays invisible but
        // selectable, and the caret is always at the end of what is typed.
        className="absolute inset-0 h-full w-full cursor-text rounded-[inherit] bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
        onChange={(event) =>
          onValueChange(event.target.value.replace(/\D/g, "").slice(0, length))
        }
        onSelect={(event) => {
          const input = event.currentTarget;
          const end = input.value.length;
          if (input.selectionStart !== end || input.selectionEnd !== end)
            input.setSelectionRange(end, end);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none flex h-full items-center justify-center gap-[0.4em] text-2xl font-medium tabular-nums"
      >
        {Array.from({ length }, (_, index) => {
          const digit = value[index];
          const caret = focused && !full && index === next;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positions, not items
            <span key={index} className="relative flex w-[1ch] justify-center">
              {digit ?? (
                <>
                  {/* An invisible 0 holds the digit's height and width. */}
                  <span className="invisible">0</span>
                  {caret ? null : (
                    <span className="absolute top-1/2 left-1/2 size-[0.22em] -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/45" />
                  )}
                </>
              )}
              {caret ? (
                <span className="absolute top-1/2 left-1/2 h-[1.1em] w-px -translate-x-1/2 -translate-y-1/2 bg-foreground motion-safe:animate-caret-blink" />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
