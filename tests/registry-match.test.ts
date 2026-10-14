import { describe, expect, test } from "bun:test";
import {
  cedulaCheckDigitValid,
  namesMatch,
} from "@/modules/citizen/registry-match";

describe("cedulaCheckDigitValid", () => {
  test("accepts a number whose last digit verifies", () => {
    // The example python-stdnum documents for `do.cedula`.
    expect(cedulaCheckDigitValid("00113918205")).toBe(true);
  });

  test("rejects a single mistyped digit", () => {
    expect(cedulaCheckDigitValid("00113918204")).toBe(false);
    expect(cedulaCheckDigitValid("00113918215")).toBe(false);
  });

  test("rejects anything that is not eleven digits", () => {
    expect(cedulaCheckDigitValid("0011391820")).toBe(false);
    expect(cedulaCheckDigitValid("001-1391820-5")).toBe(false);
  });
});

describe("namesMatch", () => {
  const registry = "MARÍA ALTAGRACIA PÉREZ DE LOS SANTOS";

  test("accepts the name a person actually uses", () => {
    expect(namesMatch("María Pérez", registry)).toBe(true);
    expect(namesMatch("maria perez", registry)).toBe(true);
    expect(namesMatch("Altagracia de los Santos", registry)).toBe(true);
  });

  test("forgives one slip in a longer word", () => {
    expect(namesMatch("Maria Peres", registry)).toBe(true);
    expect(namesMatch("Maria Altagrasia", registry)).toBe(true);
  });

  test("needs two words, so a first name alone confirms nothing", () => {
    expect(namesMatch("María", registry)).toBe(false);
  });

  test("rejects a word the registry does not hold", () => {
    expect(namesMatch("María Rodríguez", registry)).toBe(false);
    expect(namesMatch("Juan Pérez", registry)).toBe(false);
  });
});
