"use client";

import type { ApiOutputs } from "@ruta/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChartColumn, FileText } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "use-intl";
import { InlineError } from "@/components/admin/error-panel";
import {
  MunicipalityFilter,
  useMunicipalityFilter,
} from "@/components/admin/municipality-filter";
import { useOutcome } from "@/components/admin/outcome";
import { QueryState } from "@/components/admin/query-state";
import { useStaff } from "@/components/admin/staff-context";
import { useStaffMutation } from "@/components/admin/use-staff-mutation";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { api, orpc } from "@/lib/web/api";
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
  const announce = useOutcome();
  const queryClient = useQueryClient();
  const { staffScope } = useStaff();
  const municipalityId = useMunicipalityFilter();
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());

  const list = useQuery(
    orpc.reports.list.queryOptions({ input: { municipalityId, limit: 26 } }),
  );

  const targetMunicipalities = municipalityId
    ? [municipalityId]
    : Array.isArray(staffScope)
      ? staffScope
      : (municipalities.data ?? []).map((item) => item.id);

  const generate = useStaffMutation<{ municipalityIds: string[] }, unknown>(
    async ({ municipalityIds }) => {
      for (const id of municipalityIds) {
        await api.reports.generate({
          requestId: crypto.randomUUID(),
          municipalityId: id,
        });
      }
    },
    {
      onSuccess: async () => {
        announce(t("queued"));
        await queryClient.invalidateQueries({ queryKey: orpc.reports.key() });
      },
    },
  );
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="t-h2">{w("title")}</h1>
        <p className="t-body-lg text-ink-2">{w("intro")}</p>
        <p className="t-body flex w-fit items-center gap-2 rounded-card bg-paper-2 px-4 py-3 font-medium text-ink">
          {t("cadence")}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <MunicipalityFilter />
        </div>
        <Button
          variant="accent"
          className="min-h-11 md:min-h-0"
          disabled={generate.isPending || targetMunicipalities.length === 0}
          onClick={() =>
            generate.mutate({ municipalityIds: targetMunicipalities })
          }
        >
          <FileText aria-hidden />
          {generate.isPending ? reports("preparingPdf") : t("generate")}
        </Button>
      </div>
      <InlineError error={generate.error} />

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
