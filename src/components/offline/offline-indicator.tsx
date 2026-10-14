"use client";

import { CloudOff, RefreshCw, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

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
 *
 * Two placements. Everywhere but the map it floats just above the bottom
 * navigation. On the map the bottom corners belong to the layers and locate
 * controls, so the map renders its own copy (`placement="map"`) under the
 * search row — where someone looks when the map stops loading — and the
 * global one steps aside there.
 */
export function OfflineIndicator({
  placement = "page",
}: {
  placement?: "page" | "map";
}) {
  const t = useTranslations("offline");
  const pathname = usePathname();
  const { pending, isFlushing, isOnline, hasError, flush } = useOfflineQueue();

  if (placement === "page" && pathname === "/mapa") return null;
  if (isOnline && pending === 0 && !hasError) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-2xl border bg-background/95 px-4 py-2.5 shadow-md backdrop-blur-sm",
        placement === "page"
          ? "fixed inset-x-3 bottom-[calc(var(--mobile-nav-height)+0.75rem)] z-50 md:inset-x-auto md:right-5 md:bottom-5 md:max-w-lg"
          : "pointer-events-auto w-full md:w-auto md:max-w-md",
        !isOnline && "border-amber-300/70 bg-amber-50/95 text-amber-950",
      )}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
        <span
          className={cn(
            "shrink-0",
            isOnline ? "text-muted-foreground" : "text-amber-700",
          )}
        >
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
