"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether what is on screen is live, said with an icon, a colour and words.
 *
 * Assumes online on the server: a page that rendered at all came over the
 * network, and the browser corrects it on hydration if that changed.
 */
export function ConnectionStatus() {
  const t = useTranslations("footer");
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const Icon = online ? Wifi : WifiOff;

  return (
    <p
      role="status"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full px-3.5 py-2 font-medium text-base",
        online ? "bg-white/10 text-white" : "bg-[#fde9d2] text-[#5a2a06]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full",
          online ? "bg-[#86efac]" : "bg-[#c2410c]",
        )}
      />
      <Icon className="size-4" aria-hidden />
      {online ? t("online") : t("offline")}
    </p>
  );
}
