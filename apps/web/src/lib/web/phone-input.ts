import { editPhoneInput } from "@ruta/shared/phone";
import type { ChangeEvent } from "react";

export function formatPhoneChange(
  event: ChangeEvent<HTMLInputElement>,
  previous: string,
): string {
  const input = event.currentTarget;
  const kind =
    event.nativeEvent instanceof InputEvent
      ? event.nativeEvent.inputType
      : undefined;
  const deletion =
    kind === "deleteContentBackward"
      ? "backward"
      : kind === "deleteContentForward"
        ? "forward"
        : undefined;
  const next = editPhoneInput(
    previous,
    input.value,
    input.selectionStart ?? input.value.length,
    deletion,
  );
  input.value = next.value;
  input.setSelectionRange(next.caret, next.caret);
  return next.value;
}
