"use client";

import { ArrowRight, OctagonX, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

const STORAGE_KEY = "ruta-cibao:dismissed-road-notice";

/**
 * A road is closed right now.
 *
 * Shown above everything else because it is the one thing on the page that
 * can change somebody's plans today. Dismissing it hides it for this visit
 * only, and only for these reports: a new closure brings it back.
 *
 * Rendered visible from the server — a reader without JavaScript, or on a
 * phone still hydrating, sees the warning rather than waiting for it.
 */
export function NoticeBar({
  reportIds,
  title,
  since,
  more,
}: {
  reportIds: string[];
  title: string;
  since: string;
  more: string | null;
}) {
  const t = useTranslations("landing.notice");
  const signature = reportIds.join(",");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY) === signature);
    } catch {
      // Storage blocked: the notice simply stays.
    }
  }, [signature]);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, signature);
    } catch {
      // Hidden for this page view anyway.
    }
  };

  return (
    <aside aria-label={t("label")} className="px-6 pt-2 md:pt-3">
      <div className="mx-auto flex max-w-7xl items-stretch gap-1 rounded-2xl bg-[#fde9d2] text-[#5a2a06]">
        <Link
          href={`/mapa?reporte=${encodeURIComponent(reportIds[0] ?? "")}`}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 pl-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 md:pl-4"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#c2410c] text-white">
            <OctagonX className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 leading-snug">
            <strong className="block font-semibold md:inline">{title}</strong>
            <span className="block text-[#7a3d0f] md:inline md:pl-2">
              {more ? `${since} · ${more}` : since}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 font-semibold underline-offset-4 sm:underline">
            <span className="sr-only sm:not-sr-only">{t("action")}</span>
            <ArrowRight className="size-5 sm:size-4" aria-hidden />
          </span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          title={t("dismiss")}
          className="flex w-12 shrink-0 items-center justify-center rounded-2xl hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
