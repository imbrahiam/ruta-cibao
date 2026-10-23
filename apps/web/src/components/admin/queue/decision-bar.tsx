"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { InlineError } from "../error-panel";

/**
 * One way to decide.
 *
 * A side with a `note` asks for a written reason before it goes through
 * (`min` characters, 0 meaning "may be left empty"); a side with `confirm`
 * asks "are you sure" in words; a bare side acts at once.
 */
export type DecisionSide = {
  label: string;
  variant?: ButtonVariant;
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
 * Not decorative: the button is disabled while the request is in flight, and a
 * card whose decision was saved stays locked until the list drops it.
 */
export function DecisionBar({
  id,
  subject,
  primary,
  secondary,
  pending,
  error,
  decided,
}: {
  id: string;
  /** What is being decided on, for the names screen readers announce. */
  subject: string;
  primary?: DecisionSide;
  secondary?: DecisionSide;
  pending: boolean;
  error: unknown;
  decided: boolean;
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

  if (decided) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-[15px] font-medium text-ink"
      >
        <CheckCircle2 aria-hidden className="size-5 shrink-0 text-accent" />
        {t("queue.decided")}
      </p>
    );
  }

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
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="sr-only">
        {t("queue.decisionGroup", { title: subject })}
      </legend>
      {side ? (
        <form
          className="flex flex-col gap-3"
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
          <p className="text-[15px] font-medium text-ink">{side.label}</p>
          {side.note ? (
            <Field
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
            </Field>
          ) : (
            <p className="t-small text-ink-2">{side.confirm}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              ref={confirmButton}
              type="submit"
              variant={side.variant === "danger" ? "primary" : "accent"}
              aria-label={actionName(side.label)}
              disabled={pending}
              aria-busy={pending}
              className="min-h-11 w-full sm:w-auto md:min-h-0"
            >
              {side.label}
            </Button>
            <Button
              disabled={pending}
              onClick={close}
              className="min-h-11 w-full sm:w-auto md:min-h-0"
            >
              {common("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {primary ? (
            <Button
              ref={(node) => {
                buttons.current.primary = node;
              }}
              variant={primary.variant ?? "accent"}
              aria-label={actionName(primary.label)}
              disabled={pending}
              aria-busy={pending}
              onClick={() => choose("primary")}
              className="min-h-11 w-full sm:w-auto md:min-h-0"
            >
              {primary.label}
            </Button>
          ) : null}
          {secondary ? (
            <Button
              ref={(node) => {
                buttons.current.secondary = node;
              }}
              variant={secondary.variant ?? "secondary"}
              aria-label={actionName(secondary.label)}
              disabled={pending}
              aria-busy={pending}
              onClick={() => choose("secondary")}
              className="min-h-11 w-full sm:w-auto md:min-h-0"
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
