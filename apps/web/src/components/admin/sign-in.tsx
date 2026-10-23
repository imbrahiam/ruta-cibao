"use client";

import { formatPhoneInput, normalizePhone } from "@ruta/shared/phone";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, MessageSquareText } from "lucide-react";
import { type FormEvent, useEffect, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/web/auth-client";

type Method = "phone" | "email";
type Step = { kind: "contact" } | { kind: "code"; method: Method; to: string };

const RESEND_SECONDS = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function failureCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
}

/**
 * Staff sign-in: the same one-time code every account uses, by phone or email.
 *
 * Signing in grants nothing by itself. What a person may do here is decided by
 * the staff role on their account, which the shell reads afterwards.
 */
export function AdminSignIn() {
  const t = useTranslations("admin");
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<Step>({ kind: "contact" });
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const describe = (failure: unknown) => {
    const reason = failureCode(failure);
    return reason === "OTP_RATE_LIMITED" || reason === "TOO_MANY_ATTEMPTS"
      ? t("rateLimited")
      : t("authError");
  };

  const send = (to: string, via: Method) =>
    startTransition(async () => {
      setError(null);
      const { error: failure } =
        via === "phone"
          ? await authClient.phoneNumber.sendOtp({ phoneNumber: to })
          : await authClient.emailOtp.sendVerificationOtp({
              email: to,
              type: "sign-in",
            });
      if (failure) {
        setError(describe(failure));
        return;
      }
      setCode("");
      setResendIn(RESEND_SECONDS);
      setStep({ kind: "code", method: via, to });
    });

  const submitContact = (event: FormEvent) => {
    event.preventDefault();
    if (method === "phone") {
      const normalized = normalizePhone(phone);
      if (!normalized) return setError(t("shell.phoneInvalid"));
      return send(normalized, "phone");
    }
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) return setError(t("shell.emailInvalid"));
    send(address, "email");
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    if (step.kind !== "code") return;
    if (!/^\d{6}$/.test(code)) return setError(t("shell.codeInvalid"));
    const { method: via, to } = step;
    startTransition(async () => {
      setError(null);
      const { error: failure } =
        via === "phone"
          ? await authClient.phoneNumber.verify({ phoneNumber: to, code })
          : await authClient.signIn.emailOtp({ email: to, otp: code });
      if (failure) {
        setError(describe(failure));
        return;
      }
      // The shell re-reads `me.get` and shows whatever this account may do.
      await queryClient.invalidateQueries();
    });
  };

  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10"
    >
      <Logo label={t("title")} />
      <div className="flex flex-col gap-2">
        <h1 className="t-h2">{t("signIn")}</h1>
        <p className="t-body text-ink-2">{t("signInBody")}</p>
      </div>

      {step.kind === "contact" ? (
        <form
          onSubmit={submitContact}
          className="flex flex-col gap-5"
          noValidate
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t("contact")}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-paper-3 p-1">
              {(["phone", "email"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={method === option}
                  onClick={() => {
                    setMethod(option);
                    setError(null);
                  }}
                  className={`press inline-flex h-11 items-center justify-center gap-2 rounded-full text-[15px] ${
                    method === option
                      ? "bg-card font-medium text-ink shadow-ring"
                      : "text-ink-2"
                  }`}
                >
                  {option === "phone" ? (
                    <MessageSquareText aria-hidden className="size-4" />
                  ) : (
                    <Mail aria-hidden className="size-4" />
                  )}
                  {t(option)}
                </button>
              ))}
            </div>
          </fieldset>

          {method === "phone" ? (
            <Field
              htmlFor="staff-phone"
              label={t("phone")}
              hint={t("shell.phoneHint")}
              error={error}
            >
              <Input
                id="staff-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={phone}
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error ? "staff-phone-error" : "staff-phone-hint"
                }
                onChange={(event) =>
                  setPhone(formatPhoneInput(event.target.value))
                }
              />
            </Field>
          ) : (
            <Field
              htmlFor="staff-email"
              label={t("email")}
              hint={t("shell.emailHint")}
              error={error}
            >
              <Input
                id="staff-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error ? "staff-email-error" : "staff-email-hint"
                }
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
          )}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            block
            disabled={pending}
          >
            {pending ? t("loading") : t("send")}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="flex flex-col gap-5" noValidate>
          <p className="t-body text-ink-2" role="status">
            {t("shell.sentTo", {
              destination:
                step.method === "phone"
                  ? `+1 ${formatPhoneInput(step.to)}`
                  : step.to,
            })}
          </p>
          <Field
            htmlFor="staff-code"
            label={t("code")}
            hint={t("shell.codeHint")}
            error={error}
          >
            <Input
              id="staff-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "staff-code-error" : "staff-code-hint"}
              className="tabular text-center text-[22px] tracking-[0.4em]"
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </Field>
          <Button
            type="submit"
            variant="accent"
            size="lg"
            block
            disabled={pending}
          >
            {pending ? t("loading") : t("verify")}
          </Button>
          <div className="flex items-center justify-between gap-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setStep({ kind: "contact" });
                setError(null);
              }}
            >
              {t("change")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending || resendIn > 0}
              onClick={() => send(step.to, step.method)}
            >
              {resendIn > 0
                ? t("shell.resendIn", { seconds: resendIn })
                : t("shell.resend")}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
