"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/web/api";
import { failureKind, failureReason } from "@/lib/web/errors";
import { FormField } from "./form-field";
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
    case "not_found":
      return "shell.gone" as const;
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

  if (compact) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t(errorMessageKey(error))}
      </p>
    );
  }

  return (
    <Alert
      variant={refused ? "default" : "destructive"}
      className="rounded-(--radius-card) p-4"
    >
      <Icon aria-hidden="true" />
      <AlertDescription className="text-foreground">
        <p>{t(errorMessageKey(error))}</p>
        {needsStepUp ? (
          <StaffStepUpForm onVerified={onRetry} />
        ) : onRetry && !refused ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2"
          >
            <RefreshCw aria-hidden="true" />
            {common("retry")}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
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
      className="mt-2 flex w-full max-w-sm flex-col gap-3"
      noValidate
    >
      <div className="flex flex-wrap gap-2">
        {(["totp", "recovery"] as const).map((item) => (
          <Button
            key={item}
            size="sm"
            variant={mode === item ? "secondary" : "ghost"}
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
      <FormField htmlFor={`${uid}-stepup`} label={t(mode)} error={stepUpError}>
        <Input
          id={`${uid}-stepup`}
          inputMode={mode === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          maxLength={mode === "totp" ? 6 : 64}
          value={code}
          aria-invalid={stepUpError ? true : undefined}
          aria-describedby={stepUpError ? `${uid}-stepup-error` : undefined}
          onChange={(event) => setCode(event.target.value)}
        />
      </FormField>
      <div>
        <Button type="submit" size="sm" disabled={busy || !code.trim()}>
          {t("verifySecurity")}
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
