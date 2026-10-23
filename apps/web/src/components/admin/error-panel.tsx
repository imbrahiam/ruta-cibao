"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api } from "@/lib/web/api";
import { failureKind, failureReason } from "@/lib/web/errors";
import { useOutcome } from "./outcome";

/**
 * A failed call, said in words a municipal reviewer can act on.
 *
 * A refusal (FORBIDDEN, which also covers a missing second-factor step-up) is
 * shown as a refusal and never as "something went wrong": retrying it will not
 * help, and the person needs to know the screen is not broken.
 */
export function errorMessageKey(error: unknown) {
  if (failureReason(error) === "staff_step_up_required") {
    return "stepUp" as const;
  }
  switch (failureKind(error)) {
    case "forbidden":
      return "forbidden" as const;
    case "unauthorized":
      return "shell.sessionExpired" as const;
    case "rate_limited":
      return "rateLimited" as const;
    case "network":
      return "shell.offline" as const;
    case "conflict":
      return "shell.conflict" as const;
    default:
      return "error" as const;
  }
}

export function ErrorPanel({
  error,
  onRetry,
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("admin");
  const common = useTranslations("common");
  const refused = failureKind(error) === "forbidden";
  const needsStepUp = failureReason(error) === "staff_step_up_required";
  const Icon = refused ? ShieldAlert : AlertTriangle;

  return (
    <div
      role="alert"
      className={
        compact
          ? "flex flex-col items-start gap-3 text-[14px] text-danger-ink"
          : "flex flex-col items-start gap-4 rounded-card bg-card p-5 shadow-ring"
      }
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-danger-ink" />
        <p className="t-body text-ink">{t(errorMessageKey(error))}</p>
      </div>
      {needsStepUp ? (
        <StaffStepUpForm onVerified={onRetry} />
      ) : onRetry && !compact && failureKind(error) !== "forbidden" ? (
        <Button size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden />
          {common("retry")}
        </Button>
      ) : null}
    </div>
  );
}

function StaffStepUpForm({
  onVerified,
}: {
  onRetry?: () => void;
  onVerified?: () => void;
}) {
  const t = useTranslations("admin");
  const queryClient = useQueryClient();
  const announce = useOutcome();
  const uid = useId();
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setStepUpError(null);
    try {
      if (mode === "totp") {
        await api.staff.verifyTotp({ code: trimmed });
      } else {
        await api.staff.verifyRecoveryCode({ code: trimmed });
      }
      announce(t("verified"));
      await queryClient.invalidateQueries();
      onVerified?.();
    } catch (err) {
      setStepUpError(
        failureKind(err) === "rate_limited" ? t("rateLimited") : t("authError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-sm flex-col gap-3"
      noValidate
    >
      <div className="flex flex-wrap gap-2">
        {(["totp", "recovery"] as const).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={mode === item ? "accent" : "secondary"}
            aria-pressed={mode === item}
            onClick={() => {
              setMode(item);
              setCode("");
              setStepUpError(null);
            }}
          >
            {t(item)}
          </Button>
        ))}
      </div>
      <Field htmlFor={`${uid}-stepup`} label={t(mode)} error={stepUpError}>
        <Input
          id={`${uid}-stepup`}
          inputMode={mode === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          maxLength={mode === "totp" ? 6 : 64}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </Field>
      <div>
        <Button
          type="submit"
          variant="accent"
          size="sm"
          disabled={busy || !code.trim()}
        >
          {busy ? t("loading") : t("verifySecurity")}
        </Button>
      </div>
    </form>
  );
}

/** Inline failure under a form control or a button row. */
export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return <ErrorPanel error={error} compact />;
}
