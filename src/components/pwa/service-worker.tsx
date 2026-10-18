"use client";

import { SerwistProvider, useSerwist } from "@serwist/turbopack/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect } from "react";
import { toastManager } from "@/components/ui/toast";

/**
 * Registers the service worker in production only.
 *
 * In development a worker intercepts every request and, when a module script
 * comes back through its cache with the wrong content type, the page renders
 * with none of its JavaScript. So development removes any worker a previous
 * production build left behind instead.
 */
export function ServiceWorker({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "production") {
    return (
      <>
        <DevCleanup />
        {children}
      </>
    );
  }

  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      <UpdatePrompt />
      {children}
    </SerwistProvider>
  );
}

function DevCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        if (registrations.length === 0) return;
        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
        window.location.reload();
      });
  }, []);
  return null;
}

/** A new version is waiting: offer it, never force it mid-report. */
function UpdatePrompt() {
  const { serwist } = useSerwist();
  const t = useTranslations("pwa");

  useEffect(() => {
    if (!serwist) return;
    let requested = false;
    const waiting = () =>
      toastManager.add({
        id: "app-update",
        type: "info",
        title: t("update"),
        timeout: 0,
        actionProps: {
          children: t("updateAction"),
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
