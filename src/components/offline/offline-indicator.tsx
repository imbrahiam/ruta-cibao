"use client";

import { CloudOff, RefreshCw, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { Link } from "@/i18n/navigation";

/**
 * Says what is happening to work the person has already done.
 *
 * Only appears when there is something to say — offline, or with items waiting.
 * A permanent connection badge would be noise; this is the one moment it
 * matters, and staying silent otherwise is what makes it worth reading.
 *
 * The wording is deliberate: "se enviará solo" rather than an error. Nothing
 * was lost, and someone standing at a washed-out bridge should not be left
 * wondering whether their report survived.
 */
export function OfflineIndicator() {
  const t = useTranslations("offline");
  const { pending, isFlushing, isOnline, hasError, flush } = useOfflineQueue();

  if (isOnline && pending === 0 && !hasError) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur-sm md:inset-x-auto md:right-5 md:bottom-5 md:max-w-lg"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
        <span className="shrink-0 text-muted-foreground">
          {isFlushing ? (
            <Spinner className="size-4" />
          ) : isOnline ? (
            <UploadCloud className="size-4" aria-hidden />
          ) : (
            <CloudOff className="size-4" aria-hidden />
          )}
        </span>

        <p className="flex-1 text-sm leading-snug">
          {hasError
            ? t("queueError")
            : !isOnline
              ? pending > 0
                ? t("offlineWithPending", { count: pending })
                : t("offline")
              : isFlushing
                ? t("sending", { count: pending })
                : t("pending", { count: pending })}
        </p>
        {pending > 0 && (
          <Link
            href="/pendientes"
            className="shrink-0 text-xs font-medium underline underline-offset-4"
          >
            {t("viewPending")}
          </Link>
        )}

        {isOnline && pending > 0 && !isFlushing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => void flush()}
          >
            <RefreshCw className="size-4" aria-hidden />
            {t("retry")}
          </Button>
        )}
      </div>
    </div>
  );
}
