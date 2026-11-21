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
