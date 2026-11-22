/**
 * Dominican phone numbers, in one place.
 *
 * A phone number is the identifier most people here can produce from memory,
 * which is why it is the default way into this app. It is also the identifier
 * people write six different ways — `809-555-1234`, `(829) 555 1234`,
 * `18495551234` — so every one of those has to land on the same account.
 *
 * Storage is E.164 (`+18095551234`), because that is what an SMS gateway wants
 * and what makes the column safe to make unique. Display is `809-555-1234`,
 * because that is how the number is written on a business card here.
 *
 * Pure and dependency-free: the input formats as you type on the client and the
 * server normalises the same string before it touches the database.
 */

/** The three area codes assigned to the Dominican Republic. */
const AREA_CODES = new Set(["809", "829", "849"]);

const NATIONAL_DIGITS = 10;

/**
 * Digits only, with the North American country code dropped if it was typed.
 *
 * Not truncated: an extra digit is a typo, and keeping the first ten would
 * turn it into someone else's number.
 */
function nationalDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length === NATIONAL_DIGITS + 1 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
}

function inputDigits(digits: string): string {
  return digits.replace(/^1/, "").slice(0, NATIONAL_DIGITS);
}

/** Format a national number as the digits arrive. */
export function formatPhoneInput(input: string): string {
  const digits = inputDigits(input.replace(/\D/g, ""));
  if (!digits) return "";
  if (digits.length < 3) return `(${digits}`;
  const area = `(${digits.slice(0, 3)})`;
  if (digits.length === 3) return area;
  const prefix = `${area} ${digits.slice(3, 6)}`;
  return digits.length <= 6 ? prefix : `${prefix}-${digits.slice(6)}`;
}

export function editPhoneInput(
  previous: string,
  input: string,
  caret: number,
  deletion?: "backward" | "forward",
): { value: string; caret: number } {
  const rawDigits = input.replace(/\D/g, "");
  let digits = inputDigits(rawDigits);
  let position = input.slice(0, caret).replace(/\D/g, "").length;
  if (rawDigits.startsWith("1")) {
    position = Math.max(0, position - 1);
  }
  // If only punctuation was deleted, delete the digit on that side of the caret.
  if (
    deletion &&
    input !== previous &&
    digits === inputDigits(previous.replace(/\D/g, ""))
  ) {
    const index = deletion === "backward" ? position - 1 : position;
    if (index >= 0 && index < digits.length) {
      digits = digits.slice(0, index) + digits.slice(index + 1);
      position = index;
    }
  }
  const value = formatPhoneInput(digits);
  if (position >= digits.length) return { value, caret: value.length };
  let remaining = position;
  for (let index = 0; index < value.length; index++) {
    if (/\d/.test(value.charAt(index)) && remaining-- === 0) {
      return { value, caret: index };
    }
  }
  return { value, caret: value.length };
}

/** Whether the field holds a complete, plausible Dominican number. */
export function isCompletePhone(input: string): boolean {
  const digits = nationalDigits(input);
  return (
    digits.length === NATIONAL_DIGITS && AREA_CODES.has(digits.slice(0, 3))
  );
}

/**
 * The storage form, or null if this is not a Dominican number.
 *
 * Null rather than a throw: the caller is always a boundary — a form, an auth
 * endpoint — and every one of them has a message to show instead.
 */
export function normalizePhone(input: string): string | null {
  if (!isCompletePhone(input)) return null;
  return `+1${nationalDigits(input)}`;
}

/** `+18095551234` back to the `809-555-1234` people recognise. */
export function formatPhone(e164: string): string {
  const digits = nationalDigits(e164);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)]
    .filter(Boolean)
    .join("-");
}
