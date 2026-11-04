"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser believes it is online. Server render assumes yes. */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * A quiet strip while offline, and a brief confirmation when the connection
 * returns. Lists keep their last data; the strip says why nothing updates.
 */
export function OfflineBanner() {
  const t = useTranslations("admin.boundary");
  const online = useOnline();
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      return;
    }
    const timer = setTimeout(() => setWasOffline(false), 3000);
    return () => clearTimeout(timer);
  }, [online]);

  return (
    <div role="status" aria-live="polite">
      {!online ? (
        <p className="flex items-center gap-2 bg-warning/15 px-4 py-2 text-sm sm:px-6 lg:px-10">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          {t("offlineBanner")}
        </p>
      ) : wasOffline ? (
        <p className="bg-success/15 px-4 py-2 text-sm sm:px-6 lg:px-10">
          {t("backOnline")}
        </p>
      ) : null}
    </div>
  );
}
