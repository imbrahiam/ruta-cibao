"use client";

import { useQuery } from "@tanstack/react-query";
import { ChartColumn, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Placeholder } from "@/components/ui/loading";
import { Tag } from "@/components/ui/tag";
import { Link } from "@/i18n/navigation";
import { orpc } from "@/lib/orpc";

/** Every weekly report in the moderator's scope, newest week first. */
export function ReportList() {
  const t = useTranslations("reports");
  const format = useFormatter();
  const { isStaff, isLoading } = useAuth();
  const list = useQuery({
    ...orpc.reports.list.queryOptions({ input: { limit: 26 } }),
    enabled: isStaff,
  });

  if (isLoading || (isStaff && list.isPending))
    return <Placeholder className="h-72" />;
  if (!isStaff) return <EmptyState icon={ChartColumn} title={t("forbidden")} />;
  const items = list.data ?? [];
  if (!items.length)
    return (
      <EmptyState icon={ChartColumn} title={t("empty")} body={t("emptyHint")} />
    );

  return (
    <ul className="stagger grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {items.map((report) => (
        <li key={report.id}>
          <Link
            href={`/informes/${report.id}`}
            className="group flex h-full flex-col rounded-card bg-card p-5 shadow-ring transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="t-label text-ink-3">{report.municipalityName}</p>
              {report.status !== "ready" ? (
                <Tag tone={report.status === "failed" ? "danger" : "warning"}>
                  {t(`statuses.${report.status}`)}
                </Tag>
              ) : null}
            </div>
            <p className="mt-2 text-[17px] font-medium tracking-[-0.012em] text-ink">
              {t("week", {
                start: format.dateTime(new Date(report.periodStart), {
                  day: "numeric",
                  month: "short",
                }),
                end: format.dateTime(
                  new Date(new Date(report.periodEnd).getTime() - 1),
                  { day: "numeric", month: "short", year: "numeric" },
                ),
              })}
            </p>
            {report.metrics ? (
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[
                  [
                    t("metrics.placesPublished"),
                    report.metrics.places.published,
                  ],
                  [
                    t("metrics.trafficReported"),
                    report.metrics.traffic.reported,
                  ],
                  [
                    t("metrics.consultationsOpened"),
                    report.metrics.consultations.opened,
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dd className="font-mono text-[22px] leading-none text-ink tabular">
                      {value}
                    </dd>
                    <dt className="t-small mt-1 text-ink-3">{label}</dt>
                  </div>
                ))}
              </dl>
            ) : null}
            <span className="t-small mt-auto flex items-center gap-1 pt-4 text-accent">
              {t("open")}
              <ChevronRight
                strokeWidth={1.5}
                className="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
