"use client";

import { Input } from "@/components/ui/input";
import { formatPhoneInput } from "@/lib/phone";

/**
 * The celular field.
 *
 * A Dominican number is ten digits, so anything else is dropped as it is typed
 * rather than accepted and rejected later — a letter simply does not appear.
 * The hyphens arrive as you go, in the 3-3-4 grouping the number is written in
 * here, and pasting works either way: `(809) 555 1234` and `18095551234` both
 * end up the same.
 *
 * The `+1` sits outside the field as a fixed label rather than inside it as
 * text someone has to type past or accidentally delete.
 */
export function PhoneInput({
  id = "telefono",
  value,
  onChange,
  placeholder,
  describedBy,
  invalid,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      data-invalid={invalid || undefined}
      className="flex h-12 items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20 dark:bg-input/30"
    >
      <span
        className="select-none border-input border-r px-3.5 py-2 text-muted-foreground text-base"
        aria-hidden
      >
        +1
      </span>
      <Input
        id={id}
        name="phone"
        value={value}
        onChange={(event) => onChange(formatPhoneInput(event.target.value))}
        // A numeric keypad on a phone. `type="tel"` also lets the browser and
        // the password manager recognise the field and fill it.
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        required
        disabled={disabled}
        // Ten digits plus the two hyphens.
        maxLength={12}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        className="h-full flex-1 rounded-none border-0 bg-transparent px-3.5 text-base tracking-wide focus-visible:ring-0 md:text-base dark:bg-transparent"
      />
    </div>
  );
}
