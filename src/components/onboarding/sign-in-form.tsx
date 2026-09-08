"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Fingerprint,
  Mail,
  MailCheck,
  MessageSquare,
  Smartphone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { PhoneInput } from "@/components/onboarding/phone-input";
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
import { useRouter } from "@/i18n/navigation";
import { authClient, signIn } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { formatPhone, isCompletePhone, normalizePhone } from "@/lib/phone";

/**
 * Getting in.
 *
 * The celular is the default because it is the identifier everybody here can
 * produce from memory, on a phone that is already in their hand, with no inbox
 * to open. Email is one tap away for the tourist, the official from another
 * province, and anyone with no signal but working Wi-Fi. Passkey sits above
 * both for a device that already has one.
 *
 * The whole thing is two steps and never leaves this screen: a number, then the
 * six digits that arrived. Verifying the code *is* the registration — there is
 * no separate sign-up, no password, and nothing else to fill in before the map
 * opens.
 *
 * Feedback is inline in the control that was pressed, so nothing moves.
 */
type Method = "phone" | "email";

type Step =
  | { kind: "form" }
  | { kind: "code"; phone: string }
  | { kind: "linkSent"; email: string };

/** Long enough that a second text is a real retry, short enough not to strand. */
const RESEND_SECONDS = 45;

const OTP_LENGTH = 6;

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return;
  return typeof error.code === "string" ? error.code : undefined;
}

/** Google's mark, so the button is recognisable rather than described. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <title>{""}</title>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.8l-3.72-2.88c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.540-2.03-6.45-4.75H1.71v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.71a11.5 11.5 0 0 0 0 10.3l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.98c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.56 15.11.5 12 .5A11.5 11.5 0 0 0 1.71 6.85l3.84 2.98C6.46 7.11 9 4.98 12 4.98Z"
      />
    </svg>
  );
}

export function SignInForm({
  callbackURL,
  googleEnabled = false,
}: {
  callbackURL: string;
  googleEnabled?: boolean;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const queryClient = useQueryClient();
  const passkeySupport = usePasskeySupport();
  const [isPending, startTransition] = useTransition();

  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<{ message: string; hint?: string } | null>(
    null,
  );
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function finishSignIn() {
    queryClient.clear();
    await queryClient.invalidateQueries({
      queryKey: orpc.me.get.queryOptions().queryKey,
    });

    // An account that has never said whether it belongs to the province is
    // asked once, on the way to wherever the person was actually going. If the
    // question cannot be answered — the network just dropped — they carry on.
    const viewer = await queryClient
      .fetchQuery(orpc.me.get.queryOptions())
      .catch(() => null);

    router.replace(
      viewer?.needsResidencyChoice
        ? `/bienvenida?next=${encodeURIComponent(callbackURL)}`
        : callbackURL,
    );
    router.refresh();
  }

  function sendCode(phoneNumber: string) {
    startTransition(async () => {
      setError(null);
      const { error: failure } = await authClient.phoneNumber.sendOtp({
        phoneNumber,
      });

      if (failure) {
        setError({
          message:
            errorCode(failure) === "INVALID_PHONE_NUMBER"
              ? t("phone.invalid")
              : t("error"),
        });
        return;
      }

      setCode("");
      setResendIn(RESEND_SECONDS);
      setStep({ kind: "code", phone: phoneNumber });
    });
  }

  function submitPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phoneNumber = normalizePhone(phone);

    if (!phoneNumber) {
      setError({ message: t("phone.invalid") });
      return;
    }

    sendCode(phoneNumber);
  }

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.kind !== "code") return;
    const phoneNumber = step.phone;

    startTransition(async () => {
      setError(null);
      const { error: failure } = await authClient.phoneNumber.verify({
        phoneNumber,
        code,
      });

      if (failure) {
        const reason = errorCode(failure);
        setError({
          message:
            reason === "OTP_EXPIRED"
              ? t("phone.expiredCode")
              : reason === "TOO_MANY_ATTEMPTS"
                ? t("phone.tooManyAttempts")
                : t("phone.invalidCode"),
        });
        return;
      }

      await finishSignIn();
    });
  }

  function submitEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      const { error: failure } = await signIn.magicLink({
        email,
        callbackURL: `/bienvenida?next=${encodeURIComponent(callbackURL)}`,
      });

      if (failure) {
        setError({ message: t("error") });
        return;
      }

      setStep({ kind: "linkSent", email });
    });
  }

  function signInWithGoogle() {
    startTransition(async () => {
      setError(null);
      // Google answers on its own domain and comes back to `callbackURL`, so
      // there is no success branch to handle here — only a failure to launch.
      const { error: failure } = await signIn.social({
        provider: "google",
        callbackURL: `/bienvenida?next=${encodeURIComponent(callbackURL)}`,
      });
      if (failure) setError({ message: t("error") });
    });
  }

  function signInWithPasskey() {
    startTransition(async () => {
      setError(null);
      const result = await signIn.passkey();

      if (!result?.error) {
        await finishSignIn();
        return;
      }

      // A failed passkey ceremony is deliberately ambiguous. The browser reports
      // the same NotAllowedError whether the person dismissed the prompt or has
      // no passkey for this site — it refuses to say which, because saying so
      // would leak whether an account exists. So the message covers the case
      // that actually strands someone (a first visit, nothing registered yet)
      // and points at the path that always works, instead of guessing.
      setError({
        message: t("passkeyNotFound"),
        hint: t("passkeyNotFoundHint"),
      });
    });
  }

  if (step.kind === "linkSent") {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-4 text-emerald-700 text-sm leading-relaxed dark:text-emerald-400">
        <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("magicLinkSent", { email: step.email })}
      </p>
    );
  }

  if (step.kind === "code") {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => {
            setStep({ kind: "form" });
            setError(null);
          }}
          className="-ml-1 flex w-fit items-center gap-1.5 rounded-md px-1 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("phone.changeNumber")}
        </button>

        <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
          <MessageSquare
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <p className="text-sm leading-relaxed">
            {t.rich("phone.codeSentTo", {
              phone: formatPhone(step.phone),
              strong: (chunks) => (
                <strong className="font-medium">{chunks}</strong>
              ),
            })}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="codigo">{t("phone.codeLabel")}</FieldLabel>
          <Input
            id="codigo"
            name="code"
            value={code}
            onChange={(event) =>
              setCode(
                event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH),
              )
            }
            inputMode="numeric"
            // What lets the phone offer the code straight from the SMS banner,
            // which is the whole reason this is one field and not six boxes.
            autoComplete="one-time-code"
            autoFocus
            maxLength={OTP_LENGTH}
            placeholder="······"
            aria-invalid={error !== null}
            className="h-14 text-center font-mono text-2xl tracking-[0.5em] md:text-2xl"
          />
          {error && <FieldError>{error.message}</FieldError>}
        </Field>

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base"
          disabled={isPending || code.length < OTP_LENGTH}
        >
          {isPending ? (
            <>
              <Spinner /> {t("phone.verifying")}
            </>
          ) : (
            t("phone.verify")
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full"
          disabled={isPending || resendIn > 0}
          onClick={() => sendCode(step.phone)}
        >
          {resendIn > 0
            ? t("phone.resendIn", { seconds: resendIn })
            : t("phone.resend")}
        </Button>
      </form>
    );
  }

  // Offered only where the device can actually complete it. A fingerprint
  // button on a machine with no fingerprint reader is a dead end.
  const showPasskey = passkeySupport === "available";

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <legend className="sr-only">{t("method.label")}</legend>
        {(["phone", "email"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={method === option}
            onClick={() => {
              setMethod(option);
              setError(null);
            }}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              method === option
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option === "phone" ? (
              <Smartphone className="size-4" aria-hidden />
            ) : (
              <Mail className="size-4" aria-hidden />
            )}
            {t(`method.${option}`)}
          </button>
        ))}
      </fieldset>

      {method === "phone" ? (
        <form onSubmit={submitPhone} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="telefono">{t("phone.label")}</FieldLabel>
            <PhoneInput
              value={phone}
              onChange={(next) => {
                setPhone(next);
                setError(null);
              }}
              placeholder={t("phone.placeholder")}
              describedBy="telefono-help"
              invalid={error !== null && !error.hint}
              disabled={isPending}
            />
            <FieldDescription id="telefono-help">
              {t("phone.help")}
            </FieldDescription>
            {error && !error.hint && <FieldError>{error.message}</FieldError>}
          </Field>

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full text-base"
            disabled={isPending || !isCompletePhone(phone)}
          >
            {isPending ? (
              <>
                <Spinner /> {t("phone.sending")}
              </>
            ) : (
              <>
                <MessageSquare className="size-5" aria-hidden />
                {t("phone.send")}
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitEmail} className="flex flex-col gap-4">
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
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              className="h-12 text-base md:text-base"
              placeholder="tu@correo.com"
            />
            <FieldDescription>{t("magicLinkHelp")}</FieldDescription>
            {error && !error.hint && <FieldError>{error.message}</FieldError>}
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
      )}

      {(googleEnabled || showPasskey) && (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">{t("or")}</span>
            <Separator className="flex-1" />
          </div>

          {googleEnabled && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 w-full text-base"
              onClick={signInWithGoogle}
              disabled={isPending}
            >
              <GoogleMark />
              {t("google")}
            </Button>
          )}

          {showPasskey && (
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
          )}

          {error?.hint && (
            <p className="rounded-xl bg-muted p-3 text-muted-foreground text-sm leading-relaxed">
              <span className="block font-medium text-foreground">
                {error.message}
              </span>
              <span className="mt-1 block">{error.hint}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
