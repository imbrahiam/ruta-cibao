"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import { orpc } from "@/lib/web/api";
import { cx } from "@/lib/web/cx";
import { ADMIN_SECTIONS } from "./nav";
import { QueryState } from "./query-state";

const COUNTED = {
  places: "/admin/queue/places",
  claims: "/admin/queue/claims",
  photos: "/admin/queue/photos",
  reports: "/admin/queue/reports",
  traffic: "/admin/queue/traffic",
  consultations: "/admin/consultations",
  contentReports: "/admin/queue/content-reports",
} as const;

/** What is waiting, section by section, with a way into each. */
export function AdminOverview() {
  const t = useTranslations("admin");
  const counts = useQuery(orpc.moderation.counts.queryOptions());

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="t-h2">{t("title")}</h1>
        <p className="t-body-lg text-ink-2">{t("intro")}</p>
      </header>

      <QueryState query={counts}>
        {(data) => (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(COUNTED) as (keyof typeof COUNTED)[]).map((key) => {
              const section = ADMIN_SECTIONS.find(
                (item) => item.href === COUNTED[key],
              );
              const Icon = section?.icon;
              const waiting = data[key];
              return (
                <li key={key}>
                  <Link
                    href={COUNTED[key]}
                    className="press flex min-h-24 items-center justify-between gap-4 rounded-card bg-card p-4 shadow-ring hover:bg-paper-2"
                  >
                    <span className="flex items-center gap-3">
                      {Icon ? (
                        <span className="flex size-10 items-center justify-center rounded-full bg-paper-2 text-ink-2">
                          <Icon aria-hidden className="size-5" />
                        </span>
                      ) : null}
                      <span className="flex flex-col">
                        <span className="text-[16px] font-medium">
                          {t(section?.label ?? key)}
                        </span>
                        <span
                          className={cx(
                            "t-small",
                            waiting > 0 ? "text-ink" : "text-ink-3",
                          )}
                        >
                          {waiting > 0
                            ? t("shell.pendingCount", { count: waiting })
                            : t("empty")}
                        </span>
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-ink-3"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>

      <p className="t-small text-ink-2">{t("cadence")}</p>
    </div>
  );
}
