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

/** Digits only, with the North American country code dropped if it was typed. */
function nationalDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  const withoutCountry =
    digits.length > NATIONAL_DIGITS && digits.startsWith("1")
      ? digits.slice(1)
      : digits;
  return withoutCountry.slice(0, NATIONAL_DIGITS);
}

/**
 * What the field shows while someone types.
 *
 * Groups of 3-3-4 with hyphens, added as the digits arrive. Anything that is
 * not a digit never appears, so a letter cannot be typed and rejected later.
 */
export function formatPhoneInput(input: string): string {
  const digits = nationalDigits(input);

  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)]
    .filter((group) => group.length > 0)
    .join("-");
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
  return formatPhoneInput(e164);
}
