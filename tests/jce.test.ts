import { describe, expect, test } from "bun:test";
import { formatCedula } from "@/components/onboarding/cedula-input";
import { parseCedula } from "@/lib/jce";

describe("parseCedula", () => {
  test("accepts the hyphenated form people actually type", () => {
    const result = parseCedula("001-1234567-8");
    expect(result.success).toBe(true);
    expect(result.success ? String(result.data) : null).toBe("00112345678");
  });

  test("accepts 11 bare digits", () => {
    expect(parseCedula("00112345678").success).toBe(true);
  });

  test("rejects anything that is not 11 digits", () => {
    for (const input of [
      "",
      "123",
      "001123456789",
      "abcdefghijk",
      "001-1234567-",
    ]) {
      expect(parseCedula(input).success).toBe(false);
    }
  });
});

describe("formatCedula", () => {
  test("groups digits the way the card prints them", () => {
    expect(formatCedula("00112345678")).toBe("001-1234567-8");
  });

  test("drops anything that is not a digit as it is typed", () => {
    expect(formatCedula("00a1b1")).toBe("001-1");
    expect(formatCedula("abc")).toBe("");
  });

  test("accepts a pasted value in either shape", () => {
    expect(formatCedula("001-1234567-8")).toBe("001-1234567-8");
    expect(formatCedula("001 1234567 8")).toBe("001-1234567-8");
  });

  test("stops at eleven digits", () => {
    expect(formatCedula("0011234567899999")).toBe("001-1234567-8");
  });

  test("groups partially while typing", () => {
    expect(formatCedula("00")).toBe("00");
    expect(formatCedula("0011")).toBe("001-1");
  });

  // Every cédula in this province starts with a zero, which is exactly what a
  // numeric input type would eat.
  test("keeps leading zeros", () => {
    expect(formatCedula("00112345678").startsWith("001")).toBe(true);
  });
});
