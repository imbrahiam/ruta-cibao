"use client";

import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { useNow, useTranslations } from "use-intl";
import {
  ModelIcon,
  type ModelName,
} from "@/components/category/category-model";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/web/api";
import { ErrorPanel } from "./error-panel";
import { moderationQueueOptions } from "./list-queries";
import { ADMIN_SECTIONS, type AdminSection as NavSection } from "./nav";
import {
  AdminPageHeader,
  AdminSection,
  InboxList,
  InboxRow,
} from "./page-frame";
import { useStaff } from "./staff-context";
import { useAdminPrefetch } from "./use-admin-prefetch";

type CountedSection = NavSection & {
  countKey: NonNullable<NavSection["countKey"]>;
};

/**
 * Traffic counts notices live on the map, not work waiting for a decision:
 * it is said apart and left out of the "Pendiente" total.
 */
const LIVE = "traffic";

/**
 * Where to start: the work waiting, heaviest first, each said in its own
 * words ("5 solicitudes por revisar"); what is live on the map now; and, in
 * one quiet line, the queues that are up to date.
 */
export function AdminOverview() {
  const t = useTranslations("admin");
  const o = useTranslations("admin.overview");
  const staff = useStaff();
  const prefetch = useAdminPrefetch(staff);
  const counts = useQuery(orpc.moderation.counts.queryOptions());
  const data = counts.data;
  const traffic = useQuery(moderationQueueOptions("traffic"));
  const now = useNow({ updateInterval: 60_000 });

  const sections = ADMIN_SECTIONS.filter(
    (section): section is CountedSection =>
      section.countKey !== undefined &&
      (!section.adminOnly || staff.staffRole === "admin"),
  );
  const work = sections.filter((section) => section.countKey !== LIVE);
  const live = sections.find((section) => section.countKey === LIVE);
  const waiting = data
    ? work
        .filter((section) => data[section.countKey] > 0)
        .sort((a, b) => data[b.countKey] - data[a.countKey])
    : [];
  const clear = data
    ? work.filter((section) => data[section.countKey] === 0)
    : [];
  const total = waiting.reduce(
    (sum, section) => sum + (data?.[section.countKey] ?? 0),
    0,
  );
  const activeNotices = data?.[LIVE] ?? 0;
  const expiringToday = (traffic.data?.traffic ?? []).filter(
    (report) =>
      new Date(report.expiresAt).toDateString() === now.toDateString(),
  ).length;

  return (
    <>
      <AdminPageHeader title={t("shell.overview")} description={t("intro")} />
      {counts.isError && !data ? (
        <ErrorPanel error={counts.error} onRetry={() => counts.refetch()} />
      ) : !data ? (
        <div role="status" aria-busy="true" className="flex max-w-xl flex-col">
          <span className="sr-only">{t("loading")}</span>
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
            <div key={index} className="flex min-h-12 items-center gap-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      ) : (
        // A reading width, so each count sits near the name it belongs to.
        <div
          aria-busy={counts.isFetching}
          className="flex max-w-xl flex-col gap-8"
        >
          {waiting.length > 0 ? (
            <AdminSection
              id="overview-waiting"
              title={t("pending")}
              count={total}
            >
              <InboxList>
                {waiting.map(({ href, label, icon: Icon, model, countKey }) => (
                  <OverviewRow
                    key={href}
                    href={href}
                    label={t(label)}
                    icon={Icon}
                    model={model}
                    figure={o(`work.${countKey as WorkKey}`, {
                      count: data[countKey],
                    })}
                    onPrefetch={() => prefetch(href)}
                  />
                ))}
              </InboxList>
            </AdminSection>
          ) : null}
          {live && activeNotices > 0 ? (
            <AdminSection id="overview-live" title={o("live")}>
              <InboxList>
                <OverviewRow
                  href={live.href}
                  label={t(live.label)}
                  icon={live.icon}
                  model={live.model}
                  figure={o("activeNotices", { count: activeNotices })}
                  note={
                    expiringToday > 0
                      ? o("expiringToday", { count: expiringToday })
                      : undefined
                  }
                  onPrefetch={() => prefetch(live.href)}
                />
              </InboxList>
            </AdminSection>
          ) : null}
          {clear.length > 0 ? (
            // Nothing to do there: one quiet line, each name still a way in.
            <p className="text-sm text-muted-foreground">
              {o("upToDate")}{" "}
              {clear.map(({ href, label }, index) => (
                <Fragment key={href}>
                  {index > 0 ? " · " : null}
                  <Link
                    href={href}
                    onPointerEnter={() => prefetch(href)}
                    onFocus={() => prefetch(href)}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t(label)}
                  </Link>
                </Fragment>
              ))}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}

type WorkKey = Exclude<CountedSection["countKey"], typeof LIVE>;

/** One line of work: its name, then what waits there in words. */
function OverviewRow({
  href,
  label,
  icon: Icon,
  model,
  figure,
  note,
  onPrefetch,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  model?: ModelName;
  figure: string;
  note?: string;
  onPrefetch: () => void;
}) {
  return (
    <InboxRow
      href={href}
      title={label}
      dense
      onPrefetch={onPrefetch}
      lead={
        // The same box either way, so names line up down the list.
        <span className="flex size-6 shrink-0 items-center justify-center">
          {model ? (
            <ModelIcon name={model} size={24} />
          ) : (
            <Icon
              aria-hidden="true"
              className="size-[18px] text-muted-foreground"
            />
          )}
        </span>
      }
      summary={
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">{figure}</span>
          {note ? <span>· {note}</span> : null}
        </span>
      }
    />
  );
}
