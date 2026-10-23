"use client";

import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { failureKind } from "@/lib/web/errors";

/**
 * A failed call, said in words a municipal reviewer can act on.
 *
 * A refusal (FORBIDDEN, which also covers a missing second-factor step-up) is
 * shown as a refusal and never as "something went wrong": retrying it will not
 * help, and the person needs to know the screen is not broken.
 */
export function errorMessageKey(error: unknown) {
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
  const Icon = refused ? ShieldAlert : AlertTriangle;

  return (
    <div
      role="alert"
      className={
        compact
          ? "flex items-start gap-2.5 text-[14px] text-danger-ink"
          : "flex flex-col items-start gap-4 rounded-card bg-card p-5 shadow-ring"
      }
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-danger-ink" />
        <p className="t-body text-ink">{t(errorMessageKey(error))}</p>
      </div>
      {onRetry && !compact && failureKind(error) !== "forbidden" ? (
        <Button size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden />
          {common("retry")}
        </Button>
      ) : null}
    </div>
  );
}

/** Inline failure under a form control or a button row. */
export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return <ErrorPanel error={error} compact />;
}
