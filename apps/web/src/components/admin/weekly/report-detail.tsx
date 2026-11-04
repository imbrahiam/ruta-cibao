"use client";

import { useQuery } from "@tanstack/react-query";
import { ChartColumn } from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";
import { ErrorPanel } from "@/components/admin/error-panel";
import { MetaList } from "@/components/admin/facts";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminSection,
} from "@/components/admin/page-frame";
import { ReportDetailSkeleton } from "@/components/admin/skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/lib/web/api";
import { failureKind } from "@/lib/web/errors";
import {
  PdfActions,
  ReportStatusIndicator,
  useWeekLabel,
} from "./report-parts";

type Figure = { label: string; value: string | number };

/** The headline figures: a flat row, the number over its label. */
function StatRow({ figures }: { figures: Figure[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-5 sm:gap-x-0">
      {figures.map((figure) => (
        <div
          key={figure.label}
          className="flex min-w-0 flex-col-reverse justify-end gap-1 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0"
        >
          <dt className="text-sm text-muted-foreground">{figure.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One block of the report: its figures as label and value rows. */
function FigureSection({
  title,
  id,
  figures,
}: {
  title: string;
  id: string;
  figures: Figure[];
}) {
  return (
    <AdminSection id={id} title={title}>
      <Table>
        <TableBody>
          {figures.map((figure) => (
            <TableRow key={figure.label} className="h-11 hover:bg-transparent">
              <TableHead scope="row" className="h-11 px-0 font-normal">
                {figure.label}
              </TableHead>
              <TableCell className="px-0 py-0 text-right font-medium tabular-nums">
                {figure.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminSection>
  );
}

/** One week in full: every figure the report holds, and its PDF. */
export function WeeklyReportDetail({ reportId }: { reportId: string }) {
  const t = useTranslations("admin");
  const r = useTranslations("reports");
  const w = useTranslations("admin.weeklyReport");
  const s = useTranslations("reports.sections");
  const m = useTranslations("reports.metrics");
  const format = useFormatter();
  const weekLabel = useWeekLabel();
  const query = useQuery(
    orpc.reports.detail.queryOptions({ input: { reportId } }),
  );

  if (!query.data) {
    if (query.isPending) {
      return (
        <div role="status" aria-busy="true">
          <span className="sr-only">{t("loading")}</span>
          <ReportDetailSkeleton />
        </div>
      );
    }
    return failureKind(query.error) === "not_found" ? (
      <AdminEmpty icon={ChartColumn} title={r("notFound")} />
    ) : (
      <ErrorPanel error={query.error} onRetry={() => query.refetch()} />
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
    <article className="flex flex-col gap-8" aria-busy={query.isFetching}>
      <AdminPageHeader
        title={week}
        badge={<ReportStatusIndicator status={report.status} />}
        description={
          <MetaList>
            {report.municipalityName}
            {report.generatedAt
              ? r("generatedAt", {
                  date: format.dateTime(new Date(report.generatedAt), "long"),
                })
              : ""}
          </MetaList>
        }
        actions={
          <PdfActions
            reportId={report.id}
            status={report.status}
            placement="page"
            label={{ municipality: report.municipalityName, week }}
          />
        }
      />

      {report.status !== "ready" ? (
        <p className="text-sm text-muted-foreground">{r(report.status)}</p>
      ) : !metrics ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {r("unreadable")}
        </p>
      ) : (
        <>
          <StatRow
            figures={[
              { label: w("statPlaces"), value: metrics.places.published },
              { label: w("statOpened"), value: metrics.consultations.opened },
              {
                label: w("statAnswered"),
                value: metrics.consultations.answered,
              },
              {
                label: w("statStillOpen"),
                value: metrics.consultations.stillOpen,
              },
              { label: w("statTraffic"), value: metrics.traffic.reported },
            ]}
          />

          <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            <FigureSection
              id="sec-places"
              title={s("places")}
              figures={[
                {
                  label: m("placesSubmitted"),
                  value: metrics.places.submitted,
                },
                {
                  label: m("placesPublished"),
                  value: metrics.places.published,
                },
                { label: m("placesRejected"), value: metrics.places.rejected },
                { label: m("placesTotal"), value: metrics.places.total },
              ]}
            />
            <FigureSection
              id="sec-traffic"
              title={s("traffic")}
              figures={[
                {
                  label: m("trafficReported"),
                  value: metrics.traffic.reported,
                },
                { label: m("trafficCleared"), value: metrics.traffic.cleared },
                { label: m("trafficExpired"), value: metrics.traffic.expired },
                { label: m("trafficRemoved"), value: metrics.traffic.removed },
              ]}
            />
            <FigureSection
              id="sec-consultations"
              title={s("consultations")}
              figures={[
                {
                  label: m("consultationsOpened"),
                  value: metrics.consultations.opened,
                },
                {
                  label: m("consultationsAnswered"),
                  value: metrics.consultations.answered,
                },
                {
                  label: m("consultationsResolved"),
                  value: metrics.consultations.resolved,
                },
                {
                  label: m("consultationsStillOpen"),
                  value: metrics.consultations.stillOpen,
                },
                {
                  label: m("medianResponse"),
                  value:
                    metrics.consultations.medianResponseHours === null
                      ? m("medianResponseNone")
                      : m("medianResponseHours", {
                          hours: Math.round(
                            metrics.consultations.medianResponseHours,
                          ),
                        }),
                },
              ]}
            />
            <FigureSection
              id="sec-routes"
              title={s("routes")}
              figures={[
                {
                  label: m("routesSubmitted"),
                  value: metrics.routes.submitted,
                },
                {
                  label: m("routesPublished"),
                  value: metrics.routes.published,
                },
              ]}
            />
            <FigureSection
              id="sec-businesses"
              title={s("businesses")}
              figures={[
                {
                  label: m("businessesClaimed"),
                  value: metrics.businesses.claimed,
                },
                {
                  label: m("businessesApproved"),
                  value: metrics.businesses.approved,
                },
              ]}
            />
            <FigureSection
              id="sec-people"
              title={s("people")}
              figures={[
                {
                  label: m("peopleContributors"),
                  value: metrics.people.contributors,
                },
                { label: m("peopleVerified"), value: metrics.people.verified },
              ]}
            />
          </div>

          <AdminSection id="sec-top" title={s("topCategories")}>
            {metrics.topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{r("noActivity")}</p>
            ) : (
              <ol className="flex flex-col">
                {metrics.topCategories.map((category) => (
                  <li
                    key={category.name}
                    className="grid h-11 grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-4 sm:grid-cols-[minmax(0,14rem)_1fr_2rem]"
                  >
                    <span className="truncate text-sm" title={category.name}>
                      {category.name}
                    </span>
                    <span aria-hidden className="h-1.5 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.max(2, (category.count / topMax) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="text-right text-sm font-medium tabular-nums">
                      {category.count}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </AdminSection>
        </>
      )}
    </article>
  );
}
