"use client";

import { CloudOff, RefreshCw, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOfflineQueue } from "@/hooks/use-offline-queue";

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
  const { pending, isFlushing, isOnline, flush } = useOfflineQueue();

  if (isOnline && pending === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-4 py-3 backdrop-blur-sm"
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
          {!isOnline
            ? pending > 0
              ? t("offlineWithPending", { count: pending })
              : t("offline")
            : isFlushing
              ? t("sending", { count: pending })
              : t("pending", { count: pending })}
        </p>

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
