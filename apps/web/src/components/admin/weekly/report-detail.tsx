"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChartColumn } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { ErrorPanel } from "@/components/admin/error-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Placeholder } from "@/components/ui/loading";
import { orpc } from "@/lib/web/api";
import { cx } from "@/lib/web/cx";
import { failureKind } from "@/lib/web/errors";
import { PdfActions, ReportStatusTag, useWeekLabel } from "./report-parts";

type Value = string | number;

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: Value;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse justify-end gap-1">
      <dt className="t-small text-ink-2">{label}</dt>
      <dd
        className={cx(
          "font-mono leading-none text-ink tabular",
          emphasis ? "text-[32px]" : "text-[22px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-card bg-card p-5 shadow-ring"
    >
      <h2 id={id} className="t-h3">
        {title}
      </h2>
      <dl className="mt-5 grid grid-cols-2 items-end gap-x-6 gap-y-5">
        {children}
      </dl>
    </section>
  );
}

/** One week in full: every figure the report holds, and its PDF. */
export function WeeklyReportDetail({ reportId }: { reportId: string }) {
  const t = useTranslations("admin");
  const r = useTranslations("reports");
  const s = useTranslations("reports.sections");
  const m = useTranslations("reports.metrics");
  const format = useFormatter();
  const weekLabel = useWeekLabel();
  const query = useQuery(
    orpc.reports.detail.queryOptions({ input: { reportId } }),
  );

  const back = (
    <Link
      href="/admin/reports"
      className="t-small -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-1 text-ink-2 hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {r("back")}
    </Link>
  );

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">{t("loading")}</span>
          <Placeholder className="h-28" />
          <Placeholder className="h-64" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        {failureKind(query.error) === "not_found" ? (
          <EmptyState icon={ChartColumn} title={r("notFound")} />
        ) : (
          <ErrorPanel error={query.error} onRetry={() => query.refetch()} />
        )}
      </div>
    );
  }

  const report = query.data;
  const metrics = report.metrics;
  const week = weekLabel(report);
  const topMax = Math.max(
    1,
    ...(metrics?.topCategories ?? []).map((c) => c.count),
  );

  return (
    <article className="flex flex-col gap-6" aria-busy={query.isFetching}>
      {back}

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <p className="t-label text-ink-3">{report.municipalityName}</p>
          <h1 className="t-h2">{week}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <ReportStatusTag status={report.status} />
            {report.generatedAt ? (
              <p className="t-small text-ink-3">
                {r("generatedAt", {
                  date: format.dateTime(new Date(report.generatedAt), "long"),
                })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="md:w-72">
          <PdfActions
            reportId={report.id}
            status={report.status}
            label={{ municipality: report.municipalityName, week }}
          />
        </div>
      </header>

      {report.status !== "ready" ? (
        <p className="t-body rounded-card bg-paper-2 p-5 text-ink-2">
          {r(report.status)}
        </p>
      ) : !metrics ? (
        <p
          role="alert"
          className="t-body rounded-card bg-paper-2 p-5 text-ink-2"
        >
          {r("unreadable")}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section id="sec-places" title={s("places")}>
            <Stat
              label={m("placesSubmitted")}
              value={metrics.places.submitted}
            />
            <Stat
              label={m("placesPublished")}
              value={metrics.places.published}
            />
            <Stat label={m("placesRejected")} value={metrics.places.rejected} />
            <Stat
              label={m("placesTotal")}
              value={metrics.places.total}
              emphasis
            />
          </Section>
          <Section id="sec-routes" title={s("routes")}>
            <Stat
              label={m("routesSubmitted")}
              value={metrics.routes.submitted}
            />
            <Stat
              label={m("routesPublished")}
              value={metrics.routes.published}
            />
          </Section>
          <Section id="sec-traffic" title={s("traffic")}>
            <Stat
              label={m("trafficReported")}
              value={metrics.traffic.reported}
              emphasis
            />
            <Stat label={m("trafficCleared")} value={metrics.traffic.cleared} />
            <Stat label={m("trafficExpired")} value={metrics.traffic.expired} />
            <Stat label={m("trafficRemoved")} value={metrics.traffic.removed} />
          </Section>
          <Section id="sec-consultations" title={s("consultations")}>
            <Stat
              label={m("consultationsStillOpen")}
              value={metrics.consultations.stillOpen}
              emphasis
            />
            <Stat
              label={m("consultationsOpened")}
              value={metrics.consultations.opened}
            />
            <Stat
              label={m("consultationsAnswered")}
              value={metrics.consultations.answered}
            />
            <Stat
              label={m("consultationsResolved")}
              value={metrics.consultations.resolved}
            />
            <Stat
              label={m("medianResponse")}
              value={
                metrics.consultations.medianResponseHours === null
                  ? m("medianResponseNone")
                  : m("medianResponseHours", {
                      hours: Math.round(
                        metrics.consultations.medianResponseHours,
                      ),
                    })
              }
            />
          </Section>
          <Section id="sec-businesses" title={s("businesses")}>
            <Stat
              label={m("businessesClaimed")}
              value={metrics.businesses.claimed}
            />
            <Stat
              label={m("businessesApproved")}
              value={metrics.businesses.approved}
            />
          </Section>
          <Section id="sec-people" title={s("people")}>
            <Stat
              label={m("peopleContributors")}
              value={metrics.people.contributors}
              emphasis
            />
            <Stat label={m("peopleVerified")} value={metrics.people.verified} />
          </Section>

          <section
            aria-labelledby="sec-top"
            className="rounded-card bg-card p-5 shadow-ring lg:col-span-2"
          >
            <h2 id="sec-top" className="t-h3">
              {s("topCategories")}
            </h2>
            {metrics.topCategories.length === 0 ? (
              <p className="t-small mt-3 text-ink-2">{r("noActivity")}</p>
            ) : (
              <ol className="mt-5 flex flex-col gap-3">
                {metrics.topCategories.map((category) => (
                  <li
                    key={category.name}
                    className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,14rem)_1fr_auto]"
                  >
                    <span className="t-small text-ink-2">{category.name}</span>
                    <span
                      aria-hidden
                      className="h-2.5 rounded-r-[4px] bg-accent"
                      style={{
                        width: `${Math.max(2, (category.count / topMax) * 100)}%`,
                      }}
                    />
                    <span className="font-mono text-[14px] text-ink tabular">
                      {category.count}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </article>
  );
}
