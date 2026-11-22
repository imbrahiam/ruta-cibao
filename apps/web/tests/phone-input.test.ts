import { expect, test } from "bun:test";
import { editPhoneInput, normalizePhone } from "@ruta/shared/phone";

test("formats typed and pasted Dominican numbers", () => {
  expect(editPhoneInput("", "8", 1)).toEqual({ value: "(8", caret: 2 });
  expect(editPhoneInput("(80", "(809", 4)).toEqual({
    value: "(809)",
    caret: 5,
  });
  const pasted = editPhoneInput("", "+1 (829) 555-1234", 17);
  expect(pasted).toEqual({ value: "(829) 555-1234", caret: 14 });
  expect(normalizePhone(pasted.value)).toBe("+18295551234");
});

test("backspacing over formatting deletes a digit at the caret", () => {
  expect(editPhoneInput("(809)", "(809", 4, "backward")).toEqual({
    value: "(80",
    caret: 3,
  });
  expect(
    editPhoneInput("(809) 555-1234", "(809) 5551234", 9, "backward"),
  ).toEqual({ value: "(809) 551-234", caret: 8 });
});

test("an extra digit is rejected, not truncated into another number", () => {
  expect(normalizePhone("18095551234")).toBe("+18095551234");
  expect(normalizePhone("+1 809 555 1234")).toBe("+18095551234");
  for (const typo of [
    "80955512349",
    "8095551234 ext 22",
    "1-809-555-1234-5",
    "1 8095551234 1",
    "118095551234",
  ]) {
    expect(normalizePhone(typo)).toBeNull();
  }
});
