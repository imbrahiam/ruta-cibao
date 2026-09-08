"use client";

import { useSerwist } from "@serwist/turbopack/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";

export function ServiceWorkerUpdate() {
  const { serwist } = useSerwist();
  const t = useTranslations("install");
  useEffect(() => {
    if (!serwist) return;
    let requested = false;
    const waiting = () =>
      toast(t("update"), {
        id: "app-update",
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: t("updateAction"),
          onClick: () => {
            requested = true;
            void serwist.messageSkipWaiting();
          },
        },
      });
    const controlling = () => {
      if (requested) window.location.reload();
    };
    serwist.addEventListener("waiting", waiting);
    serwist.addEventListener("controlling", controlling);
    return () => {
      serwist.removeEventListener("waiting", waiting);
      serwist.removeEventListener("controlling", controlling);
    };
  }, [serwist, t]);
  return null;
}
