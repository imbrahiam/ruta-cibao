"use client";

import type { ApiOutputs } from "@ruta/contracts";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChartColumn } from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";
import { InlineError } from "@/components/admin/error-panel";
import { weeklyReportOptions } from "@/components/admin/list-queries";
import {
  MunicipalityFilter,
  useMunicipalityFilter,
} from "@/components/admin/municipality-filter";
import { useOutcome } from "@/components/admin/outcome";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminSection,
  AdminToolbar,
  InboxList,
  InboxRow,
} from "@/components/admin/page-frame";
import { QueryState } from "@/components/admin/query-state";
import { useStaff } from "@/components/admin/staff-context";
import { useAdminPrefetch } from "@/components/admin/use-admin-prefetch";
import { useStaffMutation } from "@/components/admin/use-staff-mutation";
import { Skeleton } from "@/components/ui/skeleton";
import { api, orpc } from "@/lib/web/api";
import { GenerateReports } from "./generate-reports";
import {
  PdfActions,
  ReportStatusIndicator,
  useWeekLabel,
  useWeekRange,
} from "./report-parts";

type Report = ApiOutputs["reports"]["list"][number];

/**
 * The five figures a reader wants before opening a report. A zero week is a
 * zero, never a blank.
 */
function useFigures() {
  const w = useTranslations("admin.weeklyReport");
  return (report: Report) => {
    const metrics = report.metrics;
    if (!metrics) return null;
    return [
      {
        key: "places" as const,
        label: w("colPlaces"),
        value: metrics.places.published,
      },
      {
        key: "opened" as const,
        label: w("colOpened"),
        value: metrics.consultations.opened,
      },
      {
        key: "answered" as const,
        label: w("colAnswered"),
        value: metrics.consultations.answered,
      },
      {
        key: "stillOpen" as const,
        label: w("colStillOpen"),
        value: metrics.consultations.stillOpen,
      },
      {
        key: "traffic" as const,
        label: w("colTraffic"),
        value: metrics.traffic.reported,
      },
    ];
  };
}

/** In a row, what still needs an answer is said first. */
const ROW_ORDER = ["stillOpen", "answered", "opened", "places", "traffic"];

/** A figure said as a phrase in a row: "1 sin responder", "2 casos abiertos". */
const ROW_FIGURE = {
  places: "rowPlaces",
  opened: "rowOpened",
  answered: "rowAnswered",
  stillOpen: "rowStillOpen",
  traffic: "rowTraffic",
} as const;

/** The reports grouped under their week, in the order the list gives them. */
function groupByWeek(
  items: Report[],
  weekLabel: (report: Report) => string,
): [string, Report[]][] {
  const groups = new Map<string, Report[]>();
  for (const report of items) {
    const week = weekLabel(report);
    groups.set(week, [...(groups.get(week) ?? []), report]);
  }
  return [...groups];
}

/** Placeholder: one week heading and its rows. */
function WeeklySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-56" />
      <ul className="flex flex-col">
        {Array.from({ length: 3 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <li key={index} className="flex min-h-16 items-center gap-3 py-3">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-48" />
            </div>
            <Skeleton className="h-4 w-24" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WeeklyReportList() {
  const t = useTranslations("admin");
  const w = useTranslations("admin.weeklyReport");
  const reports = useTranslations("reports");
  const format = useFormatter();
  const weekLabel = useWeekLabel();
  const weekRange = useWeekRange();
  const announce = useOutcome();
  const queryClient = useQueryClient();
  const { staffScope } = useStaff();
  const municipalityId = useMunicipalityFilter();
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());

  const list = useQuery({
    ...weeklyReportOptions(municipalityId),
    placeholderData: keepPreviousData,
  });
  const prefetch = useAdminPrefetch(useStaff());

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
      onSuccess: () => {
        announce(t("queued"));
      },
      // The new week appears when the list refreshes behind the confirmation.
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.reports.key() });
      },
    },
  );
  const figuresOf = useFigures();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={w("title")}
        description={w("intro")}
        actions={
          <GenerateReports
            municipalities={targetMunicipalities.map(
              (id) =>
                municipalities.data?.find((item) => item.id === id)?.name ?? id,
            )}
            pending={generate.isPending}
            onConfirm={() =>
              generate.mutate({ municipalityIds: targetMunicipalities })
            }
          />
        }
      />

      <AdminToolbar>
        <MunicipalityFilter />
      </AdminToolbar>
      <InlineError error={generate.error} />

      <QueryState query={list} skeleton={<WeeklySkeleton />}>
        {(items) =>
          items.length === 0 ? (
            <AdminEmpty
              icon={ChartColumn}
              title={reports("empty")}
              description={reports("emptyHint")}
            />
          ) : (
            // One section per week, the municipalities under it: the list
            // reads by week first instead of repeating the same dates per row.
            <div className="flex max-w-5xl flex-col gap-6">
              {groupByWeek(items, weekLabel).map(([week, group]) => (
                <AdminSection
                  key={week}
                  title={weekRange(group[0] as Report)}
                  count={`· ${w("reportCount", { count: group.length })}`}
                >
                  <InboxList>
                    {group.map((report) => {
                      const figures =
                        report.status === "ready" ? figuresOf(report) : null;
                      const busy = figures
                        ?.filter((figure) => figure.value > 0)
                        .sort(
                          (a, b) =>
                            ROW_ORDER.indexOf(a.key) - ROW_ORDER.indexOf(b.key),
                        );
                      const note =
                        report.status === "ready" && !figures
                          ? reports("unreadable")
                          : "";
                      const href = `/admin/reports/${report.id}`;
                      return (
                        <InboxRow
                          key={report.id}
                          href={href}
                          title={report.municipalityName}
                          openLabel={w("openFor", {
                            municipality: report.municipalityName,
                            week,
                          })}
                          onPrefetch={() => prefetch(href)}
                          badge={
                            // Ready is the normal case and goes unsaid.
                            report.status === "ready" ? null : (
                              <ReportStatusIndicator status={report.status} />
                            )
                          }
                          // What moved this week, right under the town it
                          // belongs to; when it was made, quieter below.
                          meta={
                            busy === undefined
                              ? undefined
                              : busy.length === 0
                                ? reports("noActivity")
                                : busy.map((figure) => (
                                    <span
                                      key={figure.key}
                                      className={
                                        figure.key === "stillOpen"
                                          ? "font-medium text-foreground"
                                          : undefined
                                      }
                                    >
                                      {w(ROW_FIGURE[figure.key], {
                                        count: figure.value,
                                      })}
                                    </span>
                                  ))
                          }
                          byline={
                            report.generatedAt || note ? (
                              <span>
                                {report.generatedAt
                                  ? reports("generatedAt", {
                                      date: format.dateTime(
                                        new Date(report.generatedAt),
                                        "short",
                                      ),
                                    })
                                  : null}
                                {note ? ` · ${note}` : null}
                              </span>
                            ) : undefined
                          }
                          actions={
                            <PdfActions
                              reportId={report.id}
                              status={report.status}
                              placement="row"
                              label={{
                                municipality: report.municipalityName,
                                week,
                              }}
                            />
                          }
                        />
                      );
                    })}
                  </InboxList>
                </AdminSection>
              ))}
            </div>
          )
        }
      </QueryState>
    </div>
  );
}
