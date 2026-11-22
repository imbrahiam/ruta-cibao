"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChartColumn } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { ErrorPanel } from "@/components/admin/error-panel";
import { MetaList } from "@/components/admin/facts";
import { AdminEmpty, AdminPageHeader } from "@/components/admin/page-frame";
import { ReportDetailSkeleton } from "@/components/admin/skeletons";
import { useDay } from "@/components/admin/use-day";
import { orpc } from "@/lib/web/api";
import { failureKind } from "@/lib/web/errors";
import {
  PdfActions,
  ReportStatusIndicator,
  useWeekLabel,
  useWeekRange,
} from "./report-parts";

/** One figure said as a phrase ("1 sin responder"); zeros are left out. */
type Phrase = { key: string; text: string; strong?: boolean } | null;

/**
 * One part of the week as a short paragraph: its name, then what moved, in
 * words, on one line. A part where nothing moved is not shown here; it is
 * named in the closing "Sin actividad en …" line instead.
 */
function ReportPart({
  id,
  title,
  phrases,
  children,
}: {
  id: string;
  title: string;
  phrases: Phrase[];
  children?: ReactNode;
}) {
  const said = phrases.filter((phrase) => phrase !== null);
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <h2 id={id} className="text-[15px] font-medium">
        {title}
      </h2>
      <MetaList className="text-[15px] text-muted-foreground">
        {said.map((phrase) => (
          <span
            key={phrase.key}
            className={
              phrase.strong ? "font-medium text-foreground" : undefined
            }
          >
            {phrase.text}
          </span>
        ))}
      </MetaList>
      {children}
    </section>
  );
}

/**
 * The cases still waiting, by title, each a way into it: what the report
 * asks someone to follow up. Read now, so it says how things stand today.
 */
function PendingConsultations({
  municipalityId,
  before,
}: {
  municipalityId: string;
  before: string;
}) {
  const w = useTranslations("admin.weeklyReport");
  const input = (status: "open" | "in_review") => ({
    // Newest first, and the ones this week left waiting can be older
    // than whatever came in since: read a full page, then keep the week's.
    input: { municipality: municipalityId, status, limit: 48 },
  });
  const open = useQuery(orpc.consultations.browse.queryOptions(input("open")));
  const review = useQuery(
    orpc.consultations.browse.queryOptions(input("in_review")),
  );
  const items = [...(open.data?.items ?? []), ...(review.data?.items ?? [])]
    .filter((item) => item.createdAt < before)
    .slice(0, 3);
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      <p className="text-[13px] text-muted-foreground">{w("pendingTitle")}</p>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/admin/consultations/${item.slug}`}
              className="group -mx-2 flex min-h-10 items-center justify-between gap-3 rounded-md px-2 text-[15px] hover:bg-accent/70"
            >
              <span className="truncate">{item.title}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm text-primary">
                {w("viewConsultation")}
                <ArrowRight aria-hidden className="size-3.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={`/admin/consultations?municipality=${encodeURIComponent(municipalityId)}&status=open`}
        className="w-fit text-sm text-primary underline-offset-4 hover:underline"
      >
        {w("pendingSeeAll")}
      </Link>
    </div>
  );
}

/** One week in full: every figure the report holds, and its PDF. */
export function WeeklyReportDetail({ reportId }: { reportId: string }) {
  const t = useTranslations("admin");
  const r = useTranslations("reports");
  const w = useTranslations("admin.weeklyReport");
  const s = useTranslations("reports.sections");
  const format = useFormatter();
  const day = useDay();
  const p = useTranslations("admin.weeklyReport.phrase");
  const weekLabel = useWeekLabel();
  const weekRange = useWeekRange();
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
  const n = (key: string, count: number, strong = false): Phrase =>
    count > 0
      ? {
          key,
          text: p(key as Parameters<typeof p>[0], { count }),
          strong,
        }
      : null;

  const parts = metrics
    ? [
        {
          id: "consultations",
          title: s("consultations"),
          phrases: [
            n("consultationsResolved", metrics.consultations.resolved),
            n("consultationsAnswered", metrics.consultations.answered),
            n("consultationsOpened", metrics.consultations.opened),
            n("consultationsStillOpen", metrics.consultations.stillOpen, true),
            metrics.consultations.medianResponseHours === null
              ? null
              : {
                  key: "median",
                  text: p("medianResponse", {
                    hours: Math.round(
                      metrics.consultations.medianResponseHours,
                    ),
                  }),
                },
          ],
          extra:
            metrics.consultations.stillOpen > 0 ? (
              <PendingConsultations
                municipalityId={report.municipalityId}
                before={report.periodEnd}
              />
            ) : null,
        },
        {
          id: "places",
          title: s("places"),
          // The map's total is context, not activity: said only beside
          // something that moved.
          phrases: [
            n("placesPublished", metrics.places.published),
            n("placesSubmitted", metrics.places.submitted),
            n("placesRejected", metrics.places.rejected),
          ],
          lead: {
            key: "total",
            text: p("placesTotal", { count: metrics.places.total }),
          },
          extra:
            metrics.topCategories.length > 0 ? (
              <MetaList className="text-sm text-muted-foreground">
                {metrics.topCategories.map((category) => (
                  <span key={category.name}>
                    {w("categoryCount", {
                      count: category.count,
                      name: category.name,
                    })}
                  </span>
                ))}
              </MetaList>
            ) : null,
        },
        {
          id: "traffic",
          title: s("traffic"),
          phrases: [
            n("trafficReported", metrics.traffic.reported),
            n("trafficCleared", metrics.traffic.cleared),
            n("trafficExpired", metrics.traffic.expired),
            n("trafficRemoved", metrics.traffic.removed),
          ],
        },
        {
          id: "routes",
          title: s("routes"),
          phrases: [
            n("routesSubmitted", metrics.routes.submitted),
            n("routesPublished", metrics.routes.published),
          ],
        },
        {
          id: "businesses",
          title: s("businesses"),
          phrases: [
            n("businessesClaimed", metrics.businesses.claimed),
            n("businessesApproved", metrics.businesses.approved),
          ],
        },
        {
          id: "people",
          title: s("people"),
          phrases: [
            n("peopleContributors", metrics.people.contributors),
            n("peopleVerified", metrics.people.verified),
          ],
        },
      ]
    : [];
  const moved = parts.filter((part) => part.phrases.some(Boolean));
  const quiet = parts.filter((part) => !part.phrases.some(Boolean));

  return (
    // One reading column: the report is read top to bottom, not scanned
    // across a wide grid of zeros.
    <article
      className="flex max-w-2xl flex-col gap-8"
      aria-busy={query.isFetching}
    >
      <AdminPageHeader
        title={w("detailTitle", { municipality: report.municipalityName })}
        badge={
          // "Descargar PDF" already says it is ready; only other states show.
          report.status === "ready" ? undefined : (
            <ReportStatusIndicator status={report.status} />
          )
        }
        description={
          <MetaList>
            {weekRange(report)}
            {report.generatedAt
              ? r("generatedAt", {
                  date: day(new Date(report.generatedAt), "long"),
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
          {moved.map((part) => (
            <ReportPart
              key={part.id}
              id={`sec-${part.id}`}
              title={part.title}
              phrases={
                "lead" in part && part.lead
                  ? [part.lead, ...part.phrases]
                  : part.phrases
              }
            >
              {part.extra}
            </ReportPart>
          ))}
          {quiet.length > 0 ? (
            <p className="text-[15px] text-muted-foreground">
              {moved.length === 0
                ? r("noActivity")
                : w("quiet", {
                    sections: format.list(
                      quiet.map((part) => part.title.toLocaleLowerCase("es")),
                      { type: "conjunction" },
                    ),
                  })}
            </p>
          ) : null}
        </>
      )}
    </article>
  );
}
