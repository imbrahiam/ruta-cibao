import { describe, expect, test } from "bun:test";
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
