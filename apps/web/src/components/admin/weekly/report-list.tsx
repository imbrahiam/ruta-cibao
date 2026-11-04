"use client";

import type { ApiOutputs } from "@ruta/contracts";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChartColumn, FileText } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "use-intl";
import { InlineError } from "@/components/admin/error-panel";
import { MetaList } from "@/components/admin/facts";
import { weeklyReportOptions } from "@/components/admin/list-queries";
import {
  MunicipalityFilter,
  useMunicipalityFilter,
} from "@/components/admin/municipality-filter";
import { useOutcome } from "@/components/admin/outcome";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTableCard,
  AdminToolbar,
} from "@/components/admin/page-frame";
import { QueryState } from "@/components/admin/query-state";
import { TableRowsSkeleton } from "@/components/admin/skeletons";
import { useStaff } from "@/components/admin/staff-context";
import { useAdminPrefetch } from "@/components/admin/use-admin-prefetch";
import { useStaffMutation } from "@/components/admin/use-staff-mutation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, orpc } from "@/lib/web/api";
import {
  PdfActions,
  ReportStatusIndicator,
  useWeekLabel,
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
      { key: "places", label: w("colPlaces"), value: metrics.places.published },
      {
        key: "opened",
        label: w("colOpened"),
        value: metrics.consultations.opened,
      },
      {
        key: "answered",
        label: w("colAnswered"),
        value: metrics.consultations.answered,
      },
      {
        key: "stillOpen",
        label: w("colStillOpen"),
        value: metrics.consultations.stillOpen,
      },
      {
        key: "traffic",
        label: w("colTraffic"),
        value: metrics.traffic.reported,
      },
    ];
  };
}

const FIGURE_HEADS = [
  "colPlaces",
  "colOpened",
  "colAnswered",
  "colStillOpen",
  "colTraffic",
] as const;

/** The column heads, shared by the list and its placeholder so they never differ. */
function WeeklyHead() {
  const w = useTranslations("admin.weeklyReport");
  return (
    <TableHeader className="max-sm:sr-only">
      <TableRow className="hover:bg-transparent">
        <TableHead className="pl-4">{w("colWeek")}</TableHead>
        <TableHead className="max-sm:hidden">{w("colStatus")}</TableHead>
        {FIGURE_HEADS.map((key) => (
          <TableHead key={key} className="hidden px-3 text-right xl:table-cell">
            {w(key)}
          </TableHead>
        ))}
        <TableHead>
          <span className="sr-only">{w("colActions")}</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** Placeholder rows: week and municipality, status, five figures, actions. */
const SKELETON_CELLS = [
  {
    cell: "pl-4",
    bars: ["h-5 w-40", "h-4 w-56", "h-4 w-72 max-w-full xl:hidden"],
  },
  { cell: "max-sm:hidden", bars: ["h-5 w-20"] },
  ...FIGURE_HEADS.map(() => ({
    cell: "hidden px-3 xl:table-cell",
    bars: ["ml-auto h-4 w-6"],
  })),
  { bars: ["ml-auto h-9 w-9 sm:w-24"] },
];

function WeeklySkeleton() {
  return (
    <AdminTableCard>
      <Table>
        <WeeklyHead />
        <TableBody>
          <TableRowsSkeleton rows={4} cells={SKELETON_CELLS} />
        </TableBody>
      </Table>
    </AdminTableCard>
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
          <Button
            disabled={generate.isPending || targetMunicipalities.length === 0}
            onClick={() =>
              generate.mutate({ municipalityIds: targetMunicipalities })
            }
          >
            <FileText aria-hidden />
            {generate.isPending ? reports("preparingPdf") : t("generate")}
          </Button>
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
            <AdminTableCard>
              <Table>
                <WeeklyHead />
                <TableBody>
                  {items.map((report) => {
                    const week = weekLabel(report);
                    const figures =
                      report.status === "ready" ? figuresOf(report) : null;
                    const generatedAt = report.generatedAt
                      ? reports("generatedAt", {
                          date: format.dateTime(
                            new Date(report.generatedAt),
                            "short",
                          ),
                        })
                      : "";
                    const note =
                      report.status === "ready" && !figures
                        ? reports("unreadable")
                        : report.status === "failed"
                          ? reports("failed")
                          : "";
                    return (
                      <TableRow key={report.id}>
                        <TableCell className="py-1.5 pl-4 whitespace-normal">
                          <Link
                            href={`/admin/reports/${report.id}`}
                            onPointerEnter={() =>
                              prefetch(`/admin/reports/${report.id}`)
                            }
                            onFocus={() =>
                              prefetch(`/admin/reports/${report.id}`)
                            }
                            className="block w-fit font-medium hover:underline"
                          >
                            {week}
                          </Link>
                          <MetaList className="text-xs max-sm:hidden">
                            {report.municipalityName}
                            {generatedAt}
                          </MetaList>
                          <MetaList className="text-xs sm:hidden">
                            {report.municipalityName}
                          </MetaList>
                          <div className="mt-1 sm:hidden">
                            <ReportStatusIndicator status={report.status} />
                          </div>
                          {figures ? (
                            <MetaList className="mt-1 text-xs xl:hidden">
                              {figures.map((figure) => (
                                <span key={figure.key}>
                                  {figure.label}{" "}
                                  <span className="text-foreground tabular-nums">
                                    {figure.value}
                                  </span>
                                </span>
                              ))}
                            </MetaList>
                          ) : note ? (
                            <p className="mt-1 text-xs text-muted-foreground xl:hidden">
                              {note}
                            </p>
                          ) : null}
                        </TableCell>

                        <TableCell className="py-1.5 max-sm:hidden">
                          <ReportStatusIndicator status={report.status} />
                        </TableCell>

                        {figures ? (
                          figures.map((figure) => (
                            <TableCell
                              key={figure.key}
                              className="hidden px-3 py-1.5 text-right tabular-nums xl:table-cell"
                            >
                              {figure.value}
                            </TableCell>
                          ))
                        ) : (
                          <TableCell
                            colSpan={FIGURE_HEADS.length}
                            className="hidden px-3 py-1.5 text-right text-xs whitespace-normal text-muted-foreground xl:table-cell"
                          >
                            {note}
                          </TableCell>
                        )}

                        <TableCell className="py-1.5 align-top">
                          <div className="flex items-start justify-end gap-1">
                            <Button
                              asChild
                              variant="ghost"
                              className="max-sm:hidden"
                            >
                              <Link
                                href={`/admin/reports/${report.id}`}
                                aria-label={w("openFor", {
                                  municipality: report.municipalityName,
                                  week,
                                })}
                              >
                                {reports("open")}
                              </Link>
                            </Button>
                            <PdfActions
                              reportId={report.id}
                              status={report.status}
                              placement="row"
                              label={{
                                municipality: report.municipalityName,
                                week,
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AdminTableCard>
          )
        }
      </QueryState>
    </div>
  );
}
