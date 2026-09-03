"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * The cédula field.
 *
 * A cédula is eleven digits, so anything else is dropped as it is typed rather
 * than accepted and rejected later — a letter simply does not appear. Pasting
 * works either way: `001-1234567-8` and `00112345678` both end up the same.
 *
 * The hyphens are added as you go, because that is how the number is printed on
 * the card people are copying from, and matching it makes the field easy to
 * check at a glance. The server normalises them away again.
 */
const GROUPS = [3, 10] as const;

export function formatCedula(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 11);

  return [
    digits.slice(0, GROUPS[0]),
    digits.slice(GROUPS[0], GROUPS[1]),
    digits.slice(GROUPS[1]),
  ]
    .filter((group) => group.length > 0)
    .join("-");
}

export function CedulaInput({
  id = "cedula",
  name = "cedula",
  placeholder,
  describedBy,
  invalid,
}: {
  id?: string;
  name?: string;
  placeholder: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <Input
      id={id}
      name={name}
      value={value}
      onChange={(event) => setValue(formatCedula(event.target.value))}
      // A numeric keypad on a phone. `type="number"` would be wrong here: it
      // strips leading zeros, and every cédula in this province starts with one.
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      required
      // 11 digits plus the two hyphens.
      maxLength={13}
      className="h-12 text-base tracking-wider"
      aria-describedby={describedBy}
      aria-invalid={invalid}
    />
  );
}
