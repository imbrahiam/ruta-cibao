"use client";

import { CloudOff, RotateCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-context";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { withOpenKeys } from "@/i18n/open-keys";
import { forget } from "@/lib/offline/queue";

/**
 * What this phone is holding until there is signal. Each item can be sent
 * now or dropped; nothing here is lost by closing the app.
 */
export function PendingList() {
  const t = useTranslations("pending");
  const tRoot = withOpenKeys(useTranslations());
  const format = useFormatter();
  const { isSignedIn } = useAuth();
  const queue = useOfflineQueue();

  if (!isSignedIn) {
    return (
      <EmptyState
        icon={CloudOff}
        title={t("signedOut")}
        action={
          <ButtonLink href="/entrar" variant="primary">
            {t("signIn")}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-paper-2 px-5 py-4">
        <p className="flex items-center gap-2.5 text-[15px] text-ink">
          {queue.isOnline ? (
            <Wifi strokeWidth={1.5} className="size-[18px] text-success" />
          ) : (
            <WifiOff strokeWidth={1.5} className="size-[18px] text-warning" />
          )}
          {queue.isOnline ? t("online") : t("offline")}
        </p>
        <Button
          size="sm"
          variant="primary"
          disabled={!queue.isOnline || queue.isFlushing || queue.pending === 0}
          onClick={() => void queue.flush()}
        >
          <RotateCw
            strokeWidth={1.5}
            className={
              queue.isFlushing ? "motion-safe:animate-spin" : undefined
            }
          />
          {queue.isFlushing ? t("sending") : t("sendNow")}
        </Button>
      </div>
      {queue.hasError ? (
        <p role="alert" className="t-small text-danger">
          {t("failed")}
        </p>
      ) : null}
      {queue.items.length === 0 ? (
        <EmptyState icon={CloudOff} title={t("empty")} body={t("emptyHint")} />
      ) : (
        <ul className="divide-y divide-line/60 overflow-hidden rounded-card bg-card shadow-ring">
          {queue.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                <CloudOff strokeWidth={1.5} className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-ink">
                  {tRoot(item.labelKey)}
                </span>
                <span className="t-small block text-ink-3">
                  {format.dateTime(new Date(item.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {item.attempts > 0
                    ? ` · ${t("attempts", { count: item.attempts })}`
                    : ""}
                  {item.blocked ? ` · ${t("blocked")}` : ""}
                </span>
              </span>
              <button
                type="button"
                aria-label={t("discard")}
                onClick={() => void forget(item.id)}
                className="press flex size-10 items-center justify-center rounded-full text-ink-3 hover:bg-paper-3 hover:text-danger"
              >
                <Trash2 strokeWidth={1.5} className="size-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
