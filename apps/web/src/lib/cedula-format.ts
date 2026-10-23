/**
 * Groups a cédula the way the card prints it, as it is typed.
 *
 * Anything that is not a digit is dropped, and the value stops at eleven
 * digits, so `001-1234567-8` and `00112345678` end up the same. The server
 * normalises the hyphens away again.
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
