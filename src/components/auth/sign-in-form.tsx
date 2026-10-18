"use client";

import { OTPField } from "@base-ui/react/otp-field";
import { useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Mail, MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { useRouter } from "@/i18n/navigation";
import { authClient, signIn } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { formatPhone, formatPhoneInput, normalizePhone } from "@/lib/phone";

type Method = "phone" | "email";
type Step =
  | { kind: "form" }
  | { kind: "code"; phone: string }
  | { kind: "linkSent"; email: string };

const RESEND_SECONDS = 45;

function failureCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
}

/**
 * Sign-in with what people here have in their pocket: a phone number first,
 * then email, Google and a passkey. No passwords. The code field asks for the
 * numeric keypad and lets the phone fill the code from the SMS.
 */
export function SignInForm({
  callbackURL,
  methods,
  googleEnabled,
}: {
  callbackURL: string;
  methods: Method[];
  googleEnabled: boolean;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const queryClient = useQueryClient();
  const passkeys = usePasskeySupport();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<Method>(methods[0] ?? "phone");
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

  const afterSignIn = async () => {
    queryClient.clear();
    const viewer = await queryClient
      .fetchQuery(orpc.me.get.queryOptions())
      .catch(() => null);
    router.replace(
      (viewer?.needsResidencyChoice
        ? `/bienvenida?next=${encodeURIComponent(callbackURL)}`
        : callbackURL) as "/mapa",
    );
    router.refresh();
  };

  const sendCode = (phoneNumber: string) =>
    startTransition(async () => {
      setError(null);
      const { error: failure } = await authClient.phoneNumber.sendOtp({
        phoneNumber,
      });
      if (failure) {
        setError({
          message:
            failureCode(failure) === "INVALID_PHONE_NUMBER"
              ? t("phone.invalid")
              : t("error"),
        });
        return;
      }
      setCode("");
      setResendIn(RESEND_SECONDS);
      setStep({ kind: "code", phone: phoneNumber });
    });

  const submitPhone = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError({ message: t("phone.invalid") });
      return;
    }
    sendCode(normalized);
  };

  const verify = (value: string) => {
    if (step.kind !== "code") return;
    const phoneNumber = step.phone;
    startTransition(async () => {
      setError(null);
      const { error: failure } = await authClient.phoneNumber.verify({
        phoneNumber,
        code: value,
      });
      if (failure) {
        const reason = failureCode(failure);
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
      await afterSignIn();
    });
  };

  const submitEmail = (event: FormEvent) => {
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
  };

  const google = () =>
    startTransition(async () => {
      setError(null);
      const { error: failure } = await signIn.social({
        provider: "google",
        callbackURL: `/bienvenida?next=${encodeURIComponent(callbackURL)}`,
      });
      if (failure) setError({ message: t("error") });
    });

  const passkey = () =>
    startTransition(async () => {
      setError(null);
      const result = await signIn.passkey();
      if (!result?.error) {
        await afterSignIn();
        return;
      }
      // The browser reports the same error for "dismissed" and "no passkey
      // here", deliberately, so the copy covers the case that strands people.
      setError({
        message: t("passkeyNotFound"),
        hint: t("passkeyNotFoundHint"),
      });
    });

  if (methods.length === 0 && !googleEnabled) {
    return (
      <p className="t-body rounded-card bg-paper-2 p-5 text-ink-2">
        {t("unavailable")}
      </p>
    );
  }

  if (step.kind === "linkSent") {
    return (
      <div className="rounded-panel bg-card p-6 shadow-ring animate-rise">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Mail strokeWidth={1.5} className="size-5" />
        </span>
        <p className="t-h3 mt-4">{t("linkSentTitle")}</p>
        <p className="t-body mt-1.5 text-ink-2">
          {t("magicLinkSent", { email: step.email })}
        </p>
        <Button
          variant="ghost"
          className="mt-4 -ml-3"
          onClick={() => setStep({ kind: "form" })}
        >
          {t("useAnother")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {step.kind === "code" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            verify(code);
          }}
          className="flex flex-col gap-4 rounded-panel bg-card p-6 shadow-ring animate-panel"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <MessageSquareText strokeWidth={1.5} className="size-5" />
          </span>
          <div>
            <p className="t-h3">{t("phone.codeTitle")}</p>
            <p className="t-body mt-1 text-ink-2">
              {t.rich("phone.codeSentTo", {
                phone: formatPhone(step.phone),
                strong: (chunks) => (
                  <strong className="font-medium text-ink">{chunks}</strong>
                ),
              })}
            </p>
          </div>
          <div>
            <label htmlFor="otp" className="text-[14px] font-medium text-ink">
              {t("phone.codeLabel")}
            </label>
            <OTPField.Root
              id="otp"
              length={6}
              value={code}
              onValueChange={setCode}
              onValueComplete={(value) => verify(value)}
              validationType="numeric"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={pending}
              className="mt-2 flex gap-2"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <OTPField.Input
                  // biome-ignore lint/suspicious/noArrayIndexKey: the slots are positions
                  key={index}
                  aria-label={t("phone.digit", { index: index + 1 })}
                  className="h-14 w-full min-w-0 rounded-input bg-card text-center font-mono text-[22px] text-ink shadow-ring outline-none transition-shadow focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-soft)]"
                />
              ))}
            </OTPField.Root>
          </div>
          {error ? (
            <p role="alert" className="t-small text-danger">
              {error.message}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            disabled={pending || code.length < 6}
          >
            {pending ? t("phone.verifying") : t("phone.verify")}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep({ kind: "form" })}
              className="press rounded-full px-2 py-1 text-[14px] text-ink-2 hover:text-ink"
            >
              {t("phone.changeNumber")}
            </button>
            <button
              type="button"
              disabled={resendIn > 0 || pending}
              onClick={() => sendCode(step.phone)}
              className="press rounded-full px-2 py-1 text-[14px] text-accent disabled:text-ink-3"
            >
              {resendIn > 0
                ? t("phone.resendIn", { seconds: resendIn })
                : t("phone.resend")}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4 rounded-panel bg-card p-6 shadow-ring">
          {methods.length > 1 ? (
            <Segmented
              label={t("method.label")}
              value={method}
              onChange={(value) => {
                setError(null);
                setMethod(value);
              }}
              className="w-full"
              options={methods.map((value) => ({
                value,
                label: t(`method.${value}`),
              }))}
            />
          ) : null}
          {method === "phone" ? (
            <form
              onSubmit={submitPhone}
              className="flex flex-col gap-4"
              key="phone"
            >
              <Field
                htmlFor="phone"
                label={t("phone.label")}
                hint={t("phone.help")}
                error={error?.message}
              >
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder={t("phone.placeholder")}
                  value={phone}
                  onChange={(event) =>
                    setPhone(formatPhoneInput(event.target.value))
                  }
                  aria-invalid={Boolean(error) || undefined}
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                disabled={pending}
              >
                {pending ? t("phone.sending") : t("phone.send")}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={submitEmail}
              className="flex flex-col gap-4"
              key="email"
            >
              <Field
                htmlFor="email"
                label={t("email")}
                hint={t("magicLinkHelp")}
                error={error?.message}
              >
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                disabled={pending}
              >
                {pending ? t("sending") : t("magicLink")}
              </Button>
            </form>
          )}
        </div>
      )}

      {step.kind === "form" && (googleEnabled || passkeys === "available") ? (
        <>
          <div className="flex items-center gap-3 text-ink-3" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            <span className="t-label">{t("or")}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="flex flex-col gap-2">
            {googleEnabled ? (
              <Button
                variant="secondary"
                size="lg"
                block
                onClick={google}
                disabled={pending}
              >
                <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]">
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.6 11.6 0 0 0 12 0 12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
                  />
                </svg>
                {t("google")}
              </Button>
            ) : null}
            {passkeys === "available" ? (
              <Button
                variant="secondary"
                size="lg"
                block
                onClick={passkey}
                disabled={pending}
              >
                <Fingerprint strokeWidth={1.5} />
                {t("passkey")}
              </Button>
            ) : null}
          </div>
          {error?.hint ? (
            <p className="t-small text-ink-2">{error.hint}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
