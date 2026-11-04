import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/web/cx";

const CONTROL =
  "w-full rounded-input bg-card text-ink shadow-ring outline-none transition-shadow duration-150 placeholder:text-ink-3 focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)] focus-visible:outline-none aria-[invalid=true]:shadow-[0_0_0_1px_var(--danger)] disabled:bg-paper-2 disabled:text-ink-3";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(CONTROL, "h-11 px-3.5", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cx(
        CONTROL,
        "min-h-28 resize-y px-3.5 py-2.5 leading-normal",
        className,
      )}
      {...props}
    />
  );
}

/** The platform's own select: the picker a phone shows is better than ours. */
export function Select({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cx(CONTROL, "h-11 appearance-none pr-10 pl-3.5", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        strokeWidth={1.5}
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-3"
      />
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor: string;
  optional?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-3 text-[14px] font-medium text-ink"
      >
        {label}
        {optional ? (
          <span className="text-[14px] font-normal text-ink-3">{optional}</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="text-[14px] leading-snug text-danger-ink"
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${htmlFor}-hint`}
          className="text-[14px] leading-snug text-ink-3"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
