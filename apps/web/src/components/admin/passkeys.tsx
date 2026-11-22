"use client";

import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/web/auth-client";
import { useDay } from "./use-day";

/**
 * The account's passkeys: the optional, quicker way in. Each one lives on a
 * device (its fingerprint, face or PIN), so the list says when it was added
 * and lets a lost device's key be removed.
 */
export function PasskeysDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.shell");
  const day = useDay();
  const list = authClient.useListPasskeys();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async (
    key: string,
    work: () => Promise<{ error?: unknown } | undefined>,
  ) => {
    setBusy(key);
    setFailed(false);
    try {
      const result = await work();
      if (result?.error) setFailed(true);
    } catch {
      // Dismissing the device's own prompt lands here; nothing was changed.
      setFailed(true);
    } finally {
      setBusy(null);
      list.refetch();
    }
  };

  const passkeys = list.data ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("passkeys")}</DialogTitle>
          <DialogDescription>{t("passkeysIntro")}</DialogDescription>
        </DialogHeader>
        {list.isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("passkeysNone")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center gap-3 py-1">
                <KeyRound
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 text-sm">
                  {t("passkeyAdded", {
                    date: day(new Date(passkey.createdAt)),
                  })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  aria-busy={busy === passkey.id}
                  onClick={() =>
                    run(passkey.id, () =>
                      authClient.passkey.deletePasskey({ id: passkey.id }),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" />
                  {t("passkeyRemove")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            {t("passkeyFailed")}
          </p>
        ) : null}
        <Button
          disabled={busy !== null}
          aria-busy={busy === "add"}
          onClick={() => run("add", () => authClient.passkey.addPasskey())}
        >
          <Plus aria-hidden="true" />
          {t("passkeyAdd")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
