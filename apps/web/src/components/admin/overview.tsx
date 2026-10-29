"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import { orpc } from "@/lib/web/api";
import { cx } from "@/lib/web/cx";
import { ADMIN_SECTIONS, type AdminSection } from "./nav";
import { AdminPageHeader } from "./page-frame";
import { QueryState } from "./query-state";
import { useStaff } from "./staff-context";
import { useAdminPrefetch } from "./use-admin-prefetch";

type CountedSection = AdminSection & {
  countKey: NonNullable<AdminSection["countKey"]>;
};
const COUNTED_SECTIONS = ADMIN_SECTIONS.filter(
  (section): section is CountedSection => section.countKey !== undefined,
);

export function AdminOverview() {
  const t = useTranslations("admin");
  const staff = useStaff();
  const prefetch = useAdminPrefetch(staff);
  const counts = useQuery(orpc.moderation.counts.queryOptions());

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t("title")} description={t("intro")} />
      <QueryState query={counts}>
        {(data) => (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COUNTED_SECTIONS.map(
              ({ href, label, icon: Icon, countKey, adminOnly }) => {
                if (adminOnly && staff.staffRole !== "admin") return null;
                const waiting = data[countKey];
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onPointerEnter={() => prefetch(href)}
                      onFocus={() => prefetch(href)}
                      onTouchStart={() => prefetch(href)}
                      className="press flex min-h-24 items-center justify-between gap-4 rounded-card bg-card p-4 shadow-ring hover:bg-paper-2"
                    >
                      <span className="flex items-center gap-3">
                        <Icon
                          aria-hidden
                          className="size-5 shrink-0 text-ink-2"
                        />
                        <span className="flex flex-col">
                          <span className="text-[16px] font-medium">
                            {t(label)}
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
              },
            )}
          </ul>
        )}
      </QueryState>
      <p className="t-small text-ink-2">{t("cadence")}</p>
    </div>
  );
}
