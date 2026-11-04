"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/web/api";
import { ErrorPanel } from "./error-panel";
import {
  ADMIN_GROUPS,
  ADMIN_SECTIONS,
  type AdminSection as NavSection,
} from "./nav";
import { AdminPageHeader, AdminSection, AdminTableCard } from "./page-frame";
import { useStaff } from "./staff-context";
import { useAdminPrefetch } from "./use-admin-prefetch";

type CountedSection = NavSection & {
  countKey: NonNullable<NavSection["countKey"]>;
};

export function AdminOverview() {
  const t = useTranslations("admin");
  const staff = useStaff();
  const prefetch = useAdminPrefetch(staff);
  const counts = useQuery(orpc.moderation.counts.queryOptions());
  const data = counts.data;

  return (
    <>
      <AdminPageHeader title={t("shell.overview")} description={t("intro")} />
      {counts.isError && !data ? (
        <ErrorPanel error={counts.error} onRetry={() => counts.refetch()} />
      ) : (
        // The groups and their rows are known before any number is: only the
        // numbers wait, so the page does not move when they arrive.
        <div
          aria-busy={data === undefined || counts.isFetching}
          className="flex flex-col gap-8"
        >
          {ADMIN_GROUPS.map((group) => {
            const sections = ADMIN_SECTIONS.filter(
              (section): section is CountedSection =>
                section.group === group.id &&
                section.countKey !== undefined &&
                (!section.adminOnly || staff.staffRole === "admin"),
            );
            if (sections.length === 0 || !group.label) return null;
            const total = data
              ? sections.reduce(
                  (sum, section) => sum + data[section.countKey],
                  0,
                )
              : 0;
            return (
              <AdminSection
                key={group.id}
                title={t(group.label)}
                count={total > 0 ? total : undefined}
              >
                <AdminTableCard>
                  <ul className="divide-y">
                    {sections.map(({ href, label, icon: Icon, countKey }) => {
                      const waiting = data?.[countKey];
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            aria-label={
                              waiting
                                ? `${t(label)}, ${t("shell.pendingCount", { count: waiting })}`
                                : t(label)
                            }
                            onPointerEnter={() => prefetch(href)}
                            onFocus={() => prefetch(href)}
                            onTouchStart={() => prefetch(href)}
                            className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-accent"
                          >
                            <Icon
                              aria-hidden="true"
                              className="size-[18px] shrink-0 text-muted-foreground"
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {t(label)}
                            </span>
                            {waiting === undefined ? (
                              <Skeleton className="h-4 w-5" />
                            ) : (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "tabular-nums",
                                  waiting > 0
                                    ? "font-medium"
                                    : "text-muted-foreground",
                                )}
                              >
                                {waiting}
                              </span>
                            )}
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4 shrink-0 text-muted-foreground"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </AdminTableCard>
              </AdminSection>
            );
          })}
        </div>
      )}
    </>
  );
}
