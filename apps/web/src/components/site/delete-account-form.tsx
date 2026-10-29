"use client";

import type { MeOutput } from "@ruta/contracts";
import { formatPhoneInput, normalizePhone } from "@ruta/shared/phone";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { IntlProvider } from "use-intl/react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { formats, TIME_ZONE } from "@/i18n/config";
import { api } from "@/lib/web/api";
import { authClient } from "@/lib/web/auth-client";
import { failureKind, failureReason } from "@/lib/web/errors";
import { LOCALE } from "@/lib/web/i18n";

const RECEIPT_STORAGE_KEY = "ruta_deletion_receipt";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Method = "phone" | "email";
type AuthStep =
  | { kind: "contact" }
  | { kind: "code"; method: Method; to: string };

export function DeleteAccountFlow({
  messages,
}: {
  messages: Record<string, unknown>;
}) {
  return (
    <IntlProvider
      locale={LOCALE}
      messages={messages as never}
      timeZone={TIME_ZONE}
      formats={formats}
    >
      <DeleteAccountCard />
    </IntlProvider>
  );
}

function DeleteAccountCard() {
  const t = useTranslations("landing");
  const admin = useTranslations("admin");
  const common = useTranslations("common");
  const delErrors = useTranslations("errors.deletion");

  const [viewer, setViewer] = useState<MeOutput | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(true);
  const [needsFreshAuth, setNeedsFreshAuth] = useState(false);

  const [method, setMethod] = useState<Method>("phone");
  const [authStep, setAuthStep] = useState<AuthStep>({ kind: "contact" });
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [confirmed, setConfirmed] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [receiptId, setReceiptId] = useState("");
  const [receiptStatus, setReceiptStatus] = useState<
    "pending" | "completed" | null
  >(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const loadViewer = useCallback(async () => {
    setLoadingViewer(true);
    try {
      const me = await api.me.get();
      setViewer(me);
    } catch {
      setViewer(null);
    } finally {
      setLoadingViewer(false);
    }
  }, []);

  const checkReceipt = useCallback(
    async (id: string) => {
      const clean = id.trim();
      if (!UUID_REGEX.test(clean)) {
        setReceiptError(t("deleteReceiptInvalid"));
        return;
      }
      setReceiptBusy(true);
      setReceiptError(null);
      try {
        const res = await api.me.deletionStatus({ deletionId: clean });
        setReceiptStatus(res.status);
      } catch (err) {
        const reason = failureReason(err);
        if (reason === "rate_limited" || failureKind(err) === "rate_limited") {
          setReceiptError(delErrors("rate_limited"));
        } else if (failureKind(err) === "not_found") {
          setReceiptError(delErrors("not_found"));
        } else {
          setReceiptError(admin("error"));
        }
      } finally {
        setReceiptBusy(false);
      }
    },
    [admin, delErrors, t],
  );

  useEffect(() => {
    void loadViewer();
    try {
      const saved = window.localStorage.getItem(RECEIPT_STORAGE_KEY);
      if (saved && UUID_REGEX.test(saved)) {
        setReceiptId(saved);
        void checkReceipt(saved);
      }
    } catch {
      // expected: storage is unavailable in private browsing.
    }
  }, [checkReceipt, loadViewer]);

  const sendOtp = async (to: string, via: Method) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const { error } =
        via === "phone"
          ? await authClient.phoneNumber.sendOtp({ phoneNumber: to })
          : await authClient.emailOtp.sendVerificationOtp({
              email: to,
              type: "sign-in",
            });
      if (error) {
        setAuthError(admin("authError"));
        return;
      }
      setCode("");
      setAuthStep({ kind: "code", method: via, to });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSendOtp = (event: FormEvent) => {
    event.preventDefault();
    if (method === "phone") {
      const normalized = normalizePhone(phone);
      if (!normalized) {
        setAuthError(admin("shell.phoneInvalid"));
        return;
      }
      void sendOtp(normalized, "phone");
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setAuthError(admin("shell.emailInvalid"));
      return;
    }
    void sendOtp(cleanEmail, "email");
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (authStep.kind !== "code") return;
    if (!/^\d{6}$/.test(code)) {
      setAuthError(admin("shell.codeInvalid"));
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      const { error } =
        authStep.method === "phone"
          ? await authClient.phoneNumber.verify({
              phoneNumber: authStep.to,
              code,
            })
          : await authClient.signIn.emailOtp({
              email: authStep.to,
              otp: code,
            });
      if (error) {
        setAuthError(admin("authError"));
        return;
      }
      setNeedsFreshAuth(false);
      setAuthStep({ kind: "contact" });
      await loadViewer();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRequestDeletion = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed || deleteBusy) return;
    const requestId = crypto.randomUUID();
    try {
      window.localStorage.setItem(RECEIPT_STORAGE_KEY, requestId);
    } catch {
      // expected: storage may be unavailable; the receipt stays in memory.
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const out = await api.me.requestDeletion({ requestId });
      setReceiptId(out.deletionId);
      setReceiptStatus(out.status);
      setViewer(null);
    } catch (err) {
      const reason = failureReason(err);
      if (reason === "recent_authentication_required") {
        setNeedsFreshAuth(true);
        setDeleteError(delErrors("recent_authentication_required"));
      } else if (reason === "last_administrator") {
        setDeleteError(delErrors("last_administrator"));
      } else {
        setDeleteError(admin("error"));
      }
    } finally {
      setDeleteBusy(false);
    }
  };

  const signedInMember =
    viewer?.kind === "member" && viewer.contactVerified && !needsFreshAuth;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5 rounded-card bg-card p-5 shadow-ring md:p-6">
        <h2 className="t-h3">{t("deleteWebTitle")}</h2>

        {loadingViewer ? (
          <p className="t-body text-ink-2">{common("loading")}</p>
        ) : signedInMember ? (
          <form
            onSubmit={handleRequestDeletion}
            className="flex flex-col gap-5"
            noValidate
          >
            <p className="t-body text-ink-2">
              {viewer.phoneNumber ?? viewer.email ?? viewer.displayName}
            </p>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={deleteBusy}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
              />
              <span className="t-body text-ink">{t("deleteConfirm")}</span>
            </label>

            {deleteError ? (
              <p
                role="alert"
                className="flex items-start gap-2 text-[14px] text-danger-ink"
              >
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                {deleteError}
              </p>
            ) : null}

            <div>
              <Button
                type="submit"
                variant="danger"
                size="lg"
                disabled={!confirmed || deleteBusy}
              >
                {deleteBusy ? common("loading") : t("deleteAction")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            {deleteError ? (
              <p
                role="alert"
                className="flex items-start gap-2 text-[14px] text-danger-ink"
              >
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                {deleteError}
              </p>
            ) : null}

            {authStep.kind === "contact" ? (
              <form
                onSubmit={handleSendOtp}
                className="flex flex-col gap-4"
                noValidate
              >
                <fieldset className="flex flex-col gap-2">
                  <legend className="sr-only">{admin("contact")}</legend>
                  <div className="grid max-w-xs grid-cols-2 gap-1 rounded-full bg-paper-3 p-1">
                    {(["phone", "email"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={method === option}
                        onClick={() => {
                          setMethod(option);
                          setAuthError(null);
                        }}
                        className={`press inline-flex h-10 items-center justify-center gap-2 rounded-full text-[14px] ${
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
                        {admin(option)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {method === "phone" ? (
                  <Field
                    htmlFor="del-phone"
                    label={admin("phone")}
                    hint={admin("shell.phoneHint")}
                    error={authError}
                  >
                    <Input
                      id="del-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      value={phone}
                      onChange={(event) =>
                        setPhone(formatPhoneInput(event.target.value))
                      }
                    />
                  </Field>
                ) : (
                  <Field
                    htmlFor="del-email"
                    label={admin("email")}
                    hint={admin("shell.emailHint")}
                    error={authError}
                  >
                    <Input
                      id="del-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </Field>
                )}

                <div>
                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    disabled={authBusy}
                  >
                    {authBusy ? common("loading") : admin("send")}
                  </Button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleVerifyOtp}
                className="flex flex-col gap-4"
                noValidate
              >
                <p className="t-small text-ink-2" role="status">
                  {admin("shell.sentTo", {
                    destination:
                      authStep.method === "phone"
                        ? `+1 ${formatPhoneInput(authStep.to)}`
                        : authStep.to,
                  })}
                </p>
                <Field
                  htmlFor="del-code"
                  label={admin("code")}
                  hint={admin("shell.codeHint")}
                  error={authError}
                >
                  <Input
                    id="del-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    className="tabular max-w-xs text-center text-[20px] tracking-[0.35em]"
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    disabled={authBusy}
                  >
                    {authBusy ? common("loading") : admin("verify")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={authBusy}
                    onClick={() => {
                      setAuthStep({ kind: "contact" });
                      setAuthError(null);
                    }}
                  >
                    {admin("change")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-card bg-card p-5 shadow-ring md:p-6">
        <h2 className="t-h3">{t("deleteCheckReceipt")}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void checkReceipt(receiptId);
          }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
          noValidate
        >
          <div className="min-w-0 flex-1">
            <Field
              htmlFor="del-receipt"
              label={t("deleteReceiptLabel")}
              error={receiptError}
            >
              <Input
                id="del-receipt"
                value={receiptId}
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
                onChange={(event) => setReceiptId(event.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" disabled={receiptBusy}>
            <RefreshCw aria-hidden />
            {receiptBusy ? common("loading") : admin("refresh")}
          </Button>
        </form>

        {receiptStatus ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2.5 pt-1"
          >
            {receiptStatus === "completed" ? (
              <Tag tone="success">
                <CheckCircle2 aria-hidden className="size-3.5" />
                {t("deleteStatusCompleted")}
              </Tag>
            ) : (
              <Tag tone="warning">
                <Clock aria-hidden className="size-3.5" />
                {t("deleteStatusPending")}
              </Tag>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
