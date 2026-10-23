/**
 * The checks made on what a person types before and after asking the civil
 * registry about it. Pure, so the rules can be tested without a database or
 * the registry.
 */

/**
 * The cédula's check digit: Luhn over the first ten digits.
 *
 * A failed check is almost always a typo, and catching it here costs nothing,
 * where sending it to the registry spends one of the platform's 50 hourly
 * lookups. It is not proof the number is wrong: a few thousand early cédulas
 * were issued with a check digit that does not verify. So a failure asks the
 * person to look again, and lets them go ahead if they are sure.
 */
export function cedulaCheckDigitValid(cedula: string): boolean {
  if (!/^\d{11}$/.test(cedula)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index++) {
    let digit = Number(cedula[index]) * (index % 2 === 0 ? 1 : 2);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(cedula[10]);
}

/** Words that join a surname rather than being one: "de los Santos". */
const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e"]);

function words(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-zñ\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !PARTICLES.has(word));
}

/** One substitution, insertion or deletion apart, at most. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Whether the name somebody typed is the name the registry holds.
 *
 * This is what stops the registry being a directory: without it, anybody with
 * an account could type any number and read back a stranger's legal name. Now
 * the name has to be known already, and the platform only ever confirms it.
 *
 * People write their names the way they use them — "María Pérez", not "MARÍA
 * ALTAGRACIA PÉREZ DE LOS SANTOS" — so the rule is: at least two words, every
 * one of them in the registry's name, accents and capitals ignored, with one
 * typing slip forgiven in words of five letters or more.
 */
export function namesMatch(typed: string, registry: string): boolean {
  const claimed = words(typed);
  const held = words(registry);
  if (claimed.length < 2) return false;
  return claimed.every((word) =>
    held.some(
      (candidate) =>
        candidate === word ||
        (word.length >= 5 && withinOneEdit(word, candidate)),
    ),
  );
}
