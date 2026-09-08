"use client";

import { Check, Download, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useInstall } from "./install-provider";

export function InstallApp() {
  const t = useTranslations("install");
  const { available, installed, pending, error, install } = useInstall();
  return (
    <div className="surface-card flex flex-col items-center gap-5 p-8 text-center sm:p-10">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        {installed ? (
          <Check className="size-7" aria-hidden />
        ) : (
          <Smartphone className="size-7" aria-hidden />
        )}
      </span>
      {installed ? (
        <div role="status">
          <h2 className="font-medium">{t("installed")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("installedHint")}
          </p>
        </div>
      ) : (
        <>
          {available && (
            <Button
              disabled={pending}
              onClick={() => void install()}
              className="h-12 rounded-full px-6"
            >
              <Download className="size-4" aria-hidden />
              {t("action")}
            </Button>
          )}
          {!available && (
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("unavailable")}
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      )}
    </div>
  );
}
