"use client";

import type { ApiOutputs } from "@ruta/contracts";
import { useQuery } from "@tanstack/react-query";
import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "use-intl";
import {
  MunicipalityFilter,
  useMunicipalityFilter,
} from "@/components/admin/municipality-filter";
import { QueryState } from "@/components/admin/query-state";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { orpc } from "@/lib/web/api";
import { PdfActions, ReportStatusTag, useWeekLabel } from "./report-parts";

type Report = ApiOutputs["reports"]["list"][number];

/** Week and municipality, status, the figures that matter, and the actions. */
const COLUMNS = "md:grid-cols-[minmax(0,1.3fr)_7.5rem_minmax(0,2.6fr)_13rem]";

/** The five figures a reader wants before opening a report. */
export function KpiLine({ report }: { report: Report }) {
  const m = useTranslations("reports.metrics");
  const metrics = report.metrics;
  // A zero week is a zero, never a blank.
  const kpis = [
    ["placesPublished", metrics?.places.published ?? 0],
    ["consultationsOpened", metrics?.consultations.opened ?? 0],
    ["consultationsAnswered", metrics?.consultations.answered ?? 0],
    ["consultationsStillOpen", metrics?.consultations.stillOpen ?? 0],
    ["trafficReported", metrics?.traffic.reported ?? 0],
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 md:grid-cols-5 md:gap-x-3">
      {kpis.map(([key, value]) => (
        <div key={key} className="flex flex-col-reverse gap-0.5">
          <dt className="t-small text-ink-3">{m(key)}</dt>
          <dd className="font-mono text-[20px] leading-none text-ink tabular">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function WeeklyReportList() {
  const t = useTranslations("admin");
  const w = useTranslations("admin.weeklyReport");
  const reports = useTranslations("reports");
  const format = useFormatter();
  const weekLabel = useWeekLabel();
  const municipalityId = useMunicipalityFilter();

  const list = useQuery(
    orpc.reports.list.queryOptions({ input: { municipalityId, limit: 26 } }),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="t-h2">{w("title")}</h1>
        <p className="t-body-lg text-ink-2">{w("intro")}</p>
        <p className="t-body flex w-fit items-center gap-2 rounded-card bg-accent-soft px-4 py-3 font-medium text-ink">
          {t("cadence")}
        </p>
      </header>

      <MunicipalityFilter />

      <QueryState query={list}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState
              icon={ChartColumn}
              title={reports("empty")}
              body={reports("emptyHint")}
            />
          ) : (
            <div className="md:overflow-hidden md:rounded-card md:bg-card md:shadow-ring">
              <div
                aria-hidden
                className={`t-label hidden gap-4 border-b border-line bg-paper-2 px-4 py-2.5 text-ink-3 md:grid ${COLUMNS}`}
              >
                <span>{w("colWeek")}</span>
                <span>{w("colStatus")}</span>
                <span>{w("colSummary")}</span>
                <span>{w("colActions")}</span>
              </div>
              <ul className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-line">
                {items.map((report) => {
                  const week = weekLabel(report);
                  return (
                    <li
                      key={report.id}
                      className={`grid gap-4 rounded-card bg-card p-4 shadow-ring md:items-start md:rounded-none md:shadow-none ${COLUMNS}`}
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="t-label text-ink-3">
                          {report.municipalityName}
                        </p>
                        <Link
                          href={`/admin/reports/${report.id}`}
                          className="text-[16px] font-medium text-ink underline-offset-2 hover:underline"
                        >
                          {week}
                        </Link>
                        {report.generatedAt ? (
                          <p className="t-small text-ink-3">
                            {reports("generatedAt", {
                              date: format.dateTime(
                                new Date(report.generatedAt),
                                "long",
                              ),
                            })}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <ReportStatusTag status={report.status} />
                      </div>

                      <div className="min-w-0">
                        {report.status !== "ready" ? (
                          <p className="t-small text-ink-2">
                            {reports(report.status)}
                          </p>
                        ) : report.metrics ? (
                          <KpiLine report={report} />
                        ) : (
                          <p className="t-small text-ink-2">
                            {reports("unreadable")}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <ButtonLink
                          href={`/admin/reports/${report.id}`}
                          variant="secondary"
                          block
                          className="max-md:min-h-11"
                          aria-label={w("openFor", {
                            municipality: report.municipalityName,
                            week,
                          })}
                        >
                          {reports("open")}
                        </ButtonLink>
                        <PdfActions
                          reportId={report.id}
                          status={report.status}
                          label={{
                            municipality: report.municipalityName,
                            week,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        }
      </QueryState>
    </div>
  );
}
