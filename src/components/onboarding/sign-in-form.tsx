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
import { signIn } from "@/lib/auth-client";

type Outcome =
  | { kind: "idle" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

/**
 * Two ways in, neither with a password.
 *
 * Passkey first for the phones that support it, magic link as the floor that
 * always works. Feedback is inline in the control that was pressed, so nothing
 * on the page moves while it happens.
 */
export function SignInForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

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
      if (result?.error)
        setOutcome({ kind: "error", message: t("passkeyError") });
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

  return (
    <div className="flex flex-col gap-5">
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

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs">{t("or")}</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={sendMagicLink} className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 text-base"
            placeholder="tu@correo.com"
          />
          <FieldDescription>{t("magicLinkHelp")}</FieldDescription>
          {outcome.kind === "error" && (
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
