"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "../error-panel";
import { FormField } from "../form-field";

/**
 * One way to decide.
 *
 * A side with a `note` asks for a written reason before it goes through
 * (`min` characters, 0 meaning "may be left empty"); a side with `confirm`
 * asks "are you sure" in words; a bare side acts at once.
 */
export type DecisionSide = {
  label: string;
  /** The confirm step is a destructive act: its button says so. */
  destructive?: boolean;
  note?: { min: number; max: number };
  confirm?: string;
  onConfirm: (note: string) => void;
};

type Slot = "primary" | "secondary";

/**
 * The decision controls every queue card shares: a primary action (publish,
 * approve) and a secondary one (reject) that opens its reason field only once
 * it is chosen.
 *
 * Not decorative: the button is disabled while the request is in flight. The
 * decided card itself leaves the list at once (see `useDecision`).
 */
export function DecisionBar({
  id,
  subject,
  primary,
  secondary,
  pending,
  error,
}: {
  id: string;
  /** What is being decided on, for the names screen readers announce. */
  subject: string;
  primary?: DecisionSide;
  secondary?: DecisionSide;
  pending: boolean;
  error: unknown;
}) {
  const t = useTranslations("admin");
  const common = useTranslations("common");
  const [open, setOpen] = useState<Slot | null>(null);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const buttons = useRef<Record<Slot, HTMLButtonElement | null>>({
    primary: null,
    secondary: null,
  });
  const textarea = useRef<HTMLTextAreaElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Slot | null>(null);

  const sides = { primary, secondary };
  const side = open ? sides[open] : undefined;

  // Opening a form moves focus into it; closing returns focus to the button
  // that opened it, so a keyboard user never loses their place.
  useEffect(() => {
    if (open) {
      (textarea.current ?? confirmButton.current)?.focus();
    } else if (returnTo.current) {
      buttons.current[returnTo.current]?.focus();
      returnTo.current = null;
    }
  }, [open]);

  const choose = (slot: Slot) => {
    const chosen = sides[slot];
    if (!chosen) return;
    if (chosen.note || chosen.confirm) {
      setNote("");
      setTouched(false);
      setOpen(slot);
      return;
    }
    chosen.onConfirm("");
  };

  const close = () => {
    returnTo.current = open;
    setOpen(null);
  };

  const trimmed = note.trim();
  const min = side?.note?.min ?? 0;
  const tooShort = trimmed.length < min;
  const invalid = touched && tooShort;
  const noteId = `${id}-note`;

  const submit = () => {
    if (!side || pending) return;
    if (tooShort) {
      setTouched(true);
      textarea.current?.focus();
      return;
    }
    side.onConfirm(trimmed);
  };

  const actionName = (label: string) =>
    t("queue.actionOn", { action: label, title: subject });

  const hint =
    min === 0
      ? t("queue.noteHintOptional")
      : min === 10
        ? t("noteHint")
        : t("queue.noteHintMin", { min });

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="sr-only">
        {t("queue.decisionGroup", { title: subject })}
      </legend>
      {side ? (
        <form
          className="flex flex-col gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !pending) {
              event.stopPropagation();
              close();
            }
          }}
        >
          {side.note ? (
            <FormField
              htmlFor={noteId}
              label={t("note")}
              optional={min === 0 ? common("optional") : undefined}
              hint={hint}
              error={
                invalid
                  ? t("queue.reasonShort", {
                      min,
                      missing: min - trimmed.length,
                    })
                  : undefined
              }
            >
              <Textarea
                id={noteId}
                ref={textarea}
                value={note}
                maxLength={side.note.max}
                aria-invalid={invalid}
                aria-describedby={
                  invalid ? `${noteId}-error` : `${noteId}-hint`
                }
                disabled={pending}
                onChange={(event) => setNote(event.target.value)}
                onBlur={() => setTouched(true)}
              />
            </FormField>
          ) : (
            <p className="text-sm text-muted-foreground">{side.confirm}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              ref={confirmButton}
              type="submit"
              variant={side.destructive ? "destructive" : "default"}
              aria-label={actionName(side.label)}
              disabled={pending}
              aria-busy={pending}
              className="pointer-coarse:h-11"
            >
              {side.label}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={close}
              className="pointer-coarse:h-11"
            >
              {common("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2 lg:flex-col">
          {primary ? (
            <Button
              ref={(node) => {
                buttons.current.primary = node;
              }}
              variant="default"
              data-decision="primary"
              data-form={Boolean(primary.note || primary.confirm)}
              aria-label={actionName(primary.label)}
              disabled={pending}
              aria-busy={pending}
              onClick={() => choose("primary")}
              className="flex-1 pointer-coarse:h-11 lg:flex-none"
            >
              {primary.label}
            </Button>
          ) : null}
          {secondary ? (
            <Button
              ref={(node) => {
                buttons.current.secondary = node;
              }}
              variant="outline"
              data-decision="secondary"
              data-form={Boolean(secondary.note || secondary.confirm)}
              aria-label={actionName(secondary.label)}
              disabled={pending}
              aria-busy={pending}
              onClick={() => choose("secondary")}
              className="flex-1 pointer-coarse:h-11 lg:flex-none"
            >
              {secondary.label}
            </Button>
          ) : null}
        </div>
      )}
      <InlineError error={error} />
    </fieldset>
  );
}
