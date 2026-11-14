"use client";

import { formatPhoneInput, normalizePhone } from "@ruta/shared/phone";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, MessageSquareText } from "lucide-react";
import { type FormEvent, useEffect, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { RoadMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/web/auth-client";
import { FormField } from "./form-field";

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
      className="mx-auto flex min-h-dvh w-full max-w-[22rem] flex-col justify-center gap-8 px-5 py-12"
    >
      <header className="flex animate-rise flex-col items-center gap-5 text-center">
        <RoadMark size={56} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-[0.9375rem] text-pretty text-muted-foreground">
            {step.kind === "contact"
              ? t("signInBody")
              : t("shell.sentTo", {
                  destination:
                    step.method === "phone"
                      ? `+1 ${formatPhoneInput(step.to)}`
                      : step.to,
                })}
          </p>
        </div>
      </header>

      {step.kind === "contact" ? (
        <form
          onSubmit={submitContact}
          className="flex animate-rise flex-col gap-4 [animation-delay:60ms]"
          noValidate
        >
          <Tabs
            value={method}
            onValueChange={(value) => {
              setMethod(value as Method);
              setError(null);
            }}
          >
            <TabsList
              aria-label={t("contact")}
              className="grid h-11 w-full grid-cols-2"
            >
              <TabsTrigger value="phone">
                <MessageSquareText aria-hidden="true" />
                {t("phone")}
              </TabsTrigger>
              <TabsTrigger value="email">
                <Mail aria-hidden="true" />
                {t("email")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {method === "phone" ? (
            <FormField
              htmlFor="staff-phone"
              label={<span className="sr-only">{t("phone")}</span>}
              error={error}
            >
              <Input
                id="staff-phone"
                key="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                autoFocus
                placeholder={t("shell.phonePlaceholder")}
                value={phone}
                className="h-12 px-4 text-base md:text-base"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "staff-phone-error" : undefined}
                onChange={(event) =>
                  setPhone(formatPhoneInput(event.target.value))
                }
              />
            </FormField>
          ) : (
            <FormField
              htmlFor="staff-email"
              label={<span className="sr-only">{t("email")}</span>}
              error={error}
            >
              <Input
                id="staff-email"
                key="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder={t("shell.emailPlaceholder")}
                value={email}
                className="h-12 px-4 text-base md:text-base"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "staff-email-error" : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
          )}

          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="h-12 w-full text-base"
          >
            {t("send")}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={submitCode}
          className="flex animate-rise flex-col gap-4"
          noValidate
        >
          <FormField
            htmlFor="staff-code"
            label={<span className="sr-only">{t("code")}</span>}
            error={error}
          >
            <Input
              id="staff-code"
              autoFocus
              placeholder="······"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "staff-code-error" : undefined}
              className="h-14 text-center text-2xl tracking-[0.4em] tabular-nums md:text-2xl"
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </FormField>
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="h-12 w-full text-base"
          >
            {t("verify")}
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
