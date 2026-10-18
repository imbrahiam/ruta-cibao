"use client";

import { CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";

/**
 * Said once, where people look when the map stops loading: the connection is
 * gone, and anything sent meanwhile is kept. Warning-tinted, never only a
 * colour: an icon and a sentence carry it.
 */
export function OfflineNotice({ className }: { className?: string }) {
  const { isSignedIn } = useAuth();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;
  return isSignedIn ? (
    <WithQueue className={className} />
  ) : (
    <Pill className={className} pending={0} />
  );
}

function WithQueue({ className }: { className?: string }) {
  const { pending } = useOfflineQueue();
  return <Pill className={className} pending={pending} />;
}

function Pill({ className, pending }: { className?: string; pending: number }) {
  const t = useTranslations("offline");
  return (
    <div
      role="status"
      className={cx(
        "pointer-events-auto flex justify-center animate-panel",
        className,
      )}
    >
      <Link
        href="/pendientes"
        className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--warning)_16%,var(--card))] px-4 py-2 text-[14px] text-ink shadow-md"
      >
        <CloudOff
          strokeWidth={1.5}
          className="size-4 text-[color-mix(in_srgb,var(--warning)_75%,var(--ink))]"
        />
        {pending > 0 ? t("noticePending", { count: pending }) : t("notice")}
      </Link>
    </div>
  );
}
