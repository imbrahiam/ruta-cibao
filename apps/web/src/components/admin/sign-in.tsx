"use client";

import { formatPhoneInput, normalizePhone } from "@ruta/shared/phone";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Mail, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { RoadMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/web/auth-client";
import {
  CODE_VALID_MS,
  COUNTDOWN_LIMIT_SECONDS,
  failureCode,
  formatCountdown,
  secondsLeft,
  waitFromFailure,
} from "@/lib/web/otp-wait";
import { formatPhoneChange } from "@/lib/web/phone-input";
import { FormField } from "./form-field";

type Method = "phone" | "email";

const METHODS = ["email", "phone"] as const;
const METHOD_ICONS = { email: Mail, phone: MessageSquareText } as const;
type Step = { kind: "contact" } | { kind: "code"; method: Method; to: string };

/** The server's cooldown between two codes to the same address. */
const RESEND_SECONDS = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Staff sign-in: the same one-time code every account uses, by phone or email.
 *
 * Signing in grants nothing by itself. What a person may do here is decided by
 * the staff role on their account, which the shell reads afterwards.
 */
export function AdminSignIn({
  phoneSignInEnabled,
}: {
  phoneSignInEnabled: boolean;
}) {
  const t = useTranslations("admin");
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<Method>("email");
  const [step, setStep] = useState<Step>({ kind: "contact" });
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const format = useFormatter();
  // Per address, so changing the contact does not lose (or borrow) a wait:
  // when another code may be asked for, and when the last one was sent.
  const [waitUntil, setWaitUntil] = useState<Record<string, number>>({});
  const [sentAt, setSentAt] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second only while some wait is running.
  const waiting = Object.values(waitUntil).some((until) => until > now);
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  const waitFor = (to: string, seconds: number) => {
    const at = Date.now();
    setNow(at);
    setWaitUntil((all) => ({ ...all, [to]: at + seconds * 1000 }));
  };

  const describe = (failure: unknown) => {
    switch (failureCode(failure)) {
      case "INVALID_OTP":
        return t("shell.codeWrong");
      case "OTP_EXPIRED":
        return t("shell.codeExpired");
      case "TOO_MANY_ATTEMPTS":
        return t("shell.tooManyAttempts");
      default:
        return t("authError");
    }
  };

  /** Where the contact step would send, or `null` while it is not valid yet. */
  const contactTarget = (): { to: string; via: Method } | null => {
    if (method === "phone") {
      const normalized = normalizePhone(phone);
      return normalized ? { to: normalized, via: "phone" } : null;
    }
    const address = email.trim().toLowerCase();
    return EMAIL.test(address) ? { to: address, via: "email" } : null;
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
        // A refused send is a wait, not an error: count it down where the
        // button is, and leave the field alone.
        const seconds = waitFromFailure(failure);
        if (seconds !== null) return waitFor(to, seconds);
        setError(describe(failure));
        return;
      }
      setCode("");
      setSentAt((all) => ({ ...all, [to]: Date.now() }));
      waitFor(to, RESEND_SECONDS);
      setStep({ kind: "code", method: via, to });
    });

  const submitContact = (event: FormEvent) => {
    event.preventDefault();
    const target = contactTarget();
    if (!target) {
      return setError(
        t(method === "phone" ? "shell.phoneInvalid" : "shell.emailInvalid"),
      );
    }
    // The code sent a moment ago still works: go type it instead of asking
    // for another one the server would refuse.
    const sent = sentAt[target.to];
    if (sent && Date.now() - sent < CODE_VALID_MS) {
      setError(null);
      setCode("");
      return setStep({ kind: "code", method: target.via, to: target.to });
    }
    send(target.to, target.via);
  };

  const target = step.kind === "code" ? { to: step.to } : contactTarget();
  // Back on the first step with an address that already has a live code:
  // the button goes to it rather than waiting to send another.
  const sentTo = target ? sentAt[target.to] : undefined;
  const resumable =
    step.kind === "contact" &&
    sentTo !== undefined &&
    now - sentTo < CODE_VALID_MS;
  const waitLeft =
    target && !resumable ? secondsLeft(waitUntil[target.to], now) : 0;
  const countdown = formatCountdown(waitLeft);
  const longWait = waitLeft > COUNTDOWN_LIMIT_SECONDS;
  const availableAt = format.dateTime(new Date(now + waitLeft * 1000), {
    hour: "numeric",
    minute: "2-digit",
  });

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
        const reason = failureCode(failure);
        // Spent or expired: this code is done, so "Enviar código" sends anew.
        if (reason === "TOO_MANY_ATTEMPTS" || reason === "OTP_EXPIRED") {
          setSentAt(({ [to]: _spent, ...rest }) => rest);
        }
        setCode("");
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
      className="mx-auto flex min-h-dvh w-full max-w-[21rem] flex-col justify-center gap-7 px-5 py-12"
    >
      <header className="flex animate-rise flex-col items-center gap-5 text-center">
        {/* The mark leads home, as it does in the site header. */}
        <Link href="/" aria-label={t("home")} className="rounded-[14px]">
          <RoadMark size={44} />
        </Link>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl leading-tight font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
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
              if (
                value !== "email" &&
                (value !== "phone" || !phoneSignInEnabled)
              )
                return;
              setMethod(value);
              setError(null);
            }}
          >
            <TabsList
              aria-label={t("contact")}
              className="grid w-full grid-cols-2 rounded-full p-1 group-data-[orientation=horizontal]/tabs:h-10 pointer-coarse:group-data-[orientation=horizontal]/tabs:h-12"
            >
              {METHODS.map((option) => {
                const Icon = METHOD_ICONS[option];
                const available = option === "email" || phoneSignInEnabled;
                const trigger = (
                  <TabsTrigger
                    key={option}
                    value={option}
                    disabled={!available}
                    className="h-full rounded-full text-sm group-data-[variant=default]/tabs-list:data-[state=active]:shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04)]"
                  >
                    <Icon aria-hidden="true" />
                    {t(option)}
                    {!available && (
                      <span className="sr-only">{t("methodUnavailable")}</span>
                    )}
                  </TabsTrigger>
                );
                if (available) return trigger;
                // A disabled button gets no pointer events, so the wrapper
                // carries the hover that explains why it is off.
                return (
                  <Tooltip key={option}>
                    <TooltipTrigger asChild>
                      <span className="flex h-full cursor-not-allowed">
                        {trigger}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t("methodUnavailable")}</TooltipContent>
                  </Tooltip>
                );
              })}
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
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                key="phone"
                autoFocus
                placeholder={t("shell.phonePlaceholder")}
                value={phone}
                className="h-10 px-3.5 pointer-coarse:h-12"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "staff-phone-error" : undefined}
                onChange={(event) => setPhone(formatPhoneChange(event, phone))}
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
                className="h-10 px-3.5 pointer-coarse:h-12"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "staff-email-error" : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
          )}

          <Button
            type="submit"
            disabled={pending || waitLeft > 0}
            aria-busy={pending}
            className="h-10 w-full pointer-coarse:h-12"
          >
            {resumable ? (
              t("shell.useSentCode")
            ) : waitLeft > 0 && !longWait ? (
              <span className="tabular-nums">
                {t("shell.sendIn", { time: countdown })}
              </span>
            ) : (
              t("send")
            )}
          </Button>
          <WaitNote
            show={waitLeft > 0}
            text={
              longWait
                ? t("shell.waitUntil", { time: availableAt })
                : t("shell.waitShort")
            }
          />
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
            <CodeInput
              id="staff-code"
              autoFocus
              value={code}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "staff-code-error" : undefined}
              onValueChange={setCode}
            />
          </FormField>
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="h-10 w-full pointer-coarse:h-12"
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
              disabled={pending || waitLeft > 0}
              onClick={() => send(step.to, step.method)}
              className="tabular-nums"
            >
              {waitLeft > 0 && !longWait
                ? t("shell.resendIn", { time: countdown })
                : t("shell.resend")}
            </Button>
          </div>
          <WaitNote
            show={longWait}
            text={t("shell.waitUntil", { time: availableAt })}
          />
        </form>
      )}
    </main>
  );
}

/**
 * Why the send button is off and until when. Announced once when it appears;
 * the ticking countdown lives in the button, outside any live region.
 */
function WaitNote({ show, text }: { show: boolean; text: string }) {
  return (
    <p
      role="status"
      className="min-h-5 text-center text-sm text-muted-foreground"
    >
      {show ? (
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-3.5" />
          {text}
        </span>
      ) : null}
    </p>
  );
}
