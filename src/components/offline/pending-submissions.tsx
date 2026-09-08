"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { CloudUpload, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { Link } from "@/i18n/navigation";
import { forget, offlineDb, type QueuedMutation } from "@/lib/offline/queue";

export function PendingSubmissions() {
  const t = useTranslations("offline");
  const format = useFormatter();
  const { viewer } = useAuth();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const { isOnline, isFlushing, flush } = useOfflineQueue();
  const items = useLiveQuery<QueuedMutation[], QueuedMutation[]>(
    () =>
      viewer?.userId
        ? offlineDb()
            .queue.where("userId")
            .equals(viewer.userId)
            .sortBy("createdAt")
        : Promise.resolve([]),
    [viewer?.userId],
    [],
  );
  return (
    <div className="mx-auto max-w-2xl">
      <CloudUpload className="mb-5 size-8 text-primary" aria-hidden />
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("pendingTitle")}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {t("pendingHint")}
      </p>
      {!viewer?.userId ? (
        <div className="surface-card mt-8 p-6">
          <p className="text-sm text-muted-foreground">{t("needsAccount")}</p>
          <Button
            className="mt-4"
            nativeButton={false}
            render={<Link href="/entrar?callbackUrl=%2Fpendientes" />}
          >
            {t("signIn")}
          </Button>
        </div>
      ) : (
        <>
          <Button
            className="my-6 h-11"
            disabled={!isOnline || isFlushing || items.length === 0}
            onClick={() => void flush()}
          >
            {isFlushing ? t("sending") : t("retry")}
          </Button>
          {items.length === 0 && (
            <p
              role="status"
              className="surface-card p-8 text-sm text-muted-foreground"
            >
              {t("nothingPending")}
            </p>
          )}
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id} className="surface-card p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-medium">
                      {item.procedure === "places.submit"
                        ? t("placeDraft")
                        : item.procedure === "traffic.report"
                          ? t("trafficDraft")
                          : t("reportDraft")}
                    </h2>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {format.dateTime(item.createdAt, {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "numeric",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("discard")}
                    onClick={() => setConfirmId(item.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                {item.blocked && (
                  <p className="mt-3 text-sm text-amber-800">{t("blocked")}</p>
                )}
                {confirmId === item.id && (
                  <div className="mt-4 rounded-xl bg-muted p-4">
                    <p className="mb-3 text-sm">{t("confirmDiscard")}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          await forget(item.id);
                          setConfirmId(null);
                        }}
                      >
                        {t("discardConfirm")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setConfirmId(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
