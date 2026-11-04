import type { ReactNode } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * A labelled control with its hint or error, built from the shadcn `Field`.
 *
 * Wire the control with `id={htmlFor}`; when `error` is set, give it
 * `aria-invalid` and `aria-describedby={`${htmlFor}-error`}` (or `-hint`).
 */
export function FormField({
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
    <Field className={cn("gap-1.5", className)} data-invalid={!!error}>
      <FieldLabel htmlFor={htmlFor} className="w-full justify-between">
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">{optional}</span>
        ) : null}
      </FieldLabel>
      {children}
      {error ? (
        <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
      ) : hint ? (
        <FieldDescription id={`${htmlFor}-hint`}>{hint}</FieldDescription>
      ) : null}
    </Field>
  );
}
