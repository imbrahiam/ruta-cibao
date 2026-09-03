"use client";

import { Fingerprint, Mail, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { signIn } from "@/lib/auth-client";

type Outcome =
  | { kind: "idle" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string; hint?: string };

/**
 * Two ways in, neither with a password.
 *
 * Passkey first for devices that have one, magic link as the floor that always
 * works. Feedback is inline in the control that was pressed, so nothing on the
 * page moves while it happens.
 */
export function SignInForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();
  const passkeySupport = usePasskeySupport();

  function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const { error } = await signIn.magicLink({
        email,
        callbackURL: "/bienvenida",
      });
      setOutcome(
        error
          ? { kind: "error", message: t("error") }
          : { kind: "sent", email },
      );
    });
  }

  function signInWithPasskey() {
    startTransition(async () => {
      const result = await signIn.passkey();
      if (!result?.error) return;

      // A failed passkey ceremony is deliberately ambiguous. The browser reports
      // the same NotAllowedError whether the person dismissed the prompt or has
      // no passkey for this site — it refuses to say which, because saying so
      // would leak whether an account exists. So the message covers the case
      // that actually strands someone (a first visit, nothing registered yet)
      // and points at the path that always works, instead of guessing.
      setOutcome({
        kind: "error",
        message: t("passkeyNotFound"),
        hint: t("passkeyNotFoundHint"),
      });
    });
  }

  if (outcome.kind === "sent") {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-4 text-emerald-700 text-sm dark:text-emerald-400">
        <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("magicLinkSent", { email: outcome.email })}
      </p>
    );
  }

  // Offered only where the device can actually complete it. A fingerprint
  // button on a machine with no fingerprint reader is a dead end.
  const showPasskey = passkeySupport === "available";

  return (
    <div className="flex flex-col gap-5">
      {showPasskey && (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full text-base"
            onClick={signInWithPasskey}
            disabled={isPending}
          >
            <Fingerprint className="size-5" aria-hidden />
            {t("passkey")}
          </Button>

          {outcome.kind === "error" && outcome.hint && (
            <p className="-mt-2 rounded-lg bg-muted p-3 text-muted-foreground text-sm leading-relaxed">
              <span className="block font-medium text-foreground">
                {outcome.message}
              </span>
              <span className="mt-1 block">{outcome.hint}</span>
            </p>
          )}

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">{t("or")}</span>
            <Separator className="flex-1" />
          </div>
        </>
      )}

      <form onSubmit={sendMagicLink} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email webauthn"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 text-base"
            placeholder="tu@correo.com"
          />
          <FieldDescription>{t("magicLinkHelp")}</FieldDescription>
          {outcome.kind === "error" && !outcome.hint && (
            <FieldError>{outcome.message}</FieldError>
          )}
        </Field>

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base"
          disabled={isPending || email.length === 0}
        >
          {isPending ? (
            <>
              <Spinner /> {t("sending")}
            </>
          ) : (
            <>
              <Mail className="size-5" aria-hidden />
              {t("magicLink")}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
