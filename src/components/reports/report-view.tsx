"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Printer } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/loading";
import { toast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { orpc } from "@/lib/orpc";

/**
 * One week, in numbers. The figures were computed once when the week closed,
 * so this page reads the same in March as it did in November. Single numbers
 * are stat tiles, not charts; the one ranking (categories) is a bar list in
 * a single hue with its values written out.
 */
export function ReportView({ reportId }: { reportId: string }) {
  const t = useTranslations("reports");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const query = useQuery(
    orpc.reports.detail.queryOptions({ input: { reportId } }),
  );
  const render = useMutation(
    orpc.reports.render.mutationOptions({
      onSuccess: (result) => {
        if (result.queued === "failed") toast.error({ title: t("pdfFailed") });
        else toast.info({ title: t("pdfQueued") });
        void queryClient.invalidateQueries({ queryKey: orpc.reports.key() });
      },
      onError: () => toast.error({ title: t("pdfFailed") }),
    }),
  );

  if (query.isPending) return <Placeholder className="h-96" />;
  if (query.isError || !query.data)
    return (
      <p className="t-body rounded-card bg-paper-2 p-6 text-ink-2">
        {t("notFound")}
      </p>
    );
  const report = query.data;
  const m = report.metrics;
  const end = new Date(new Date(report.periodEnd).getTime() - 1);

  return (
    <article>
      <Link
        href="/informes"
        className="t-small inline-flex items-center gap-1.5 text-ink-2 hover:text-ink print:hidden"
      >
        <ArrowLeft strokeWidth={1.5} className="size-4" />
        {t("back")}
      </Link>
      <header className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="animate-rise">
          <p className="t-label text-ink-3">{report.municipalityName}</p>
          <h1 className="t-h2 mt-3">
            {t("week", {
              start: format.dateTime(new Date(report.periodStart), {
                day: "numeric",
                month: "long",
              }),
              end: format.dateTime(end, {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
          </h1>
          {report.generatedAt ? (
            <p className="t-small mt-2 text-ink-3">
              {t("generatedAt", {
                date: format.dateTime(new Date(report.generatedAt), "long"),
              })}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer strokeWidth={1.5} />
            {t("print")}
          </Button>
          {report.pdfUrl ? (
            <a
              href={report.pdfUrl}
              className="press inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[15px] font-medium text-paper hover:opacity-90"
              download
            >
              <Download strokeWidth={1.5} className="size-[18px]" />
              {t("downloadPdf")}
            </a>
          ) : (
            <Button
              variant="primary"
              disabled={render.isPending}
              onClick={() => render.mutate({ reportId })}
            >
              <FileText strokeWidth={1.5} />
              {render.isPending ? t("preparingPdf") : t("preparePdf")}
            </Button>
          )}
        </div>
      </header>

      {report.status !== "ready" || !m ? (
        <p className="t-body mt-8 rounded-card bg-paper-2 p-6 text-ink-2">
          {t(
            report.status === "failed"
              ? "failed"
              : report.status === "pending"
                ? "pending"
                : "unreadable",
          )}
        </p>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Section title={t("sections.places")}>
            <Stat
              label={t("metrics.placesSubmitted")}
              value={m.places.submitted}
            />
            <Stat
              label={t("metrics.placesPublished")}
              value={m.places.published}
            />
            <Stat
              label={t("metrics.placesRejected")}
              value={m.places.rejected}
            />
            <Stat
              label={t("metrics.placesTotal")}
              value={m.places.total}
              emphasis
            />
          </Section>
          <Section title={t("sections.traffic")}>
            <Stat
              label={t("metrics.trafficReported")}
              value={m.traffic.reported}
              emphasis
            />
            <Stat
              label={t("metrics.trafficCleared")}
              value={m.traffic.cleared}
            />
            <Stat
              label={t("metrics.trafficExpired")}
              value={m.traffic.expired}
            />
            <Stat
              label={t("metrics.trafficRemoved")}
              value={m.traffic.removed}
            />
          </Section>
          <Section title={t("sections.consultations")}>
            <Stat
              label={t("metrics.consultationsOpened")}
              value={m.consultations.opened}
              emphasis
            />
            <Stat
              label={t("metrics.consultationsAnswered")}
              value={m.consultations.answered}
            />
            <Stat
              label={t("metrics.consultationsResolved")}
              value={m.consultations.resolved}
            />
            <Stat
              label={t("metrics.medianResponse")}
              value={
                m.consultations.medianResponseHours === null
                  ? t("metrics.medianResponseNone")
                  : t("metrics.medianResponseHours", {
                      hours: Math.round(m.consultations.medianResponseHours),
                    })
              }
            />
          </Section>
          <Section title={t("sections.people")}>
            <Stat
              label={t("metrics.peopleContributors")}
              value={m.people.contributors}
              emphasis
            />
            <Stat
              label={t("metrics.peopleVerified")}
              value={m.people.verified}
            />
            <Stat
              label={t("metrics.businessesClaimed")}
              value={m.businesses.claimed}
            />
            <Stat
              label={t("metrics.routesPublished")}
              value={m.routes.published}
            />
          </Section>
          <section className="rounded-panel bg-card p-6 shadow-ring lg:col-span-2">
            <h2 className="t-h3">{t("sections.topCategories")}</h2>
            {m.topCategories.length === 0 ? (
              <p className="t-small mt-3 text-ink-3">{t("noActivity")}</p>
            ) : (
              <ol className="mt-5 flex flex-col gap-3">
                {m.topCategories.map((category) => {
                  const max = Math.max(
                    ...m.topCategories.map((item) => item.count),
                    1,
                  );
                  return (
                    <li
                      key={category.name}
                      className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3"
                    >
                      <span className="t-small truncate text-ink-2">
                        {category.name}
                      </span>
                      <span
                        className="h-2.5 rounded-r-[4px] bg-accent"
                        style={{
                          width: `${Math.max(2, (category.count / max) * 100)}%`,
                        }}
                        title={`${category.name}: ${category.count}`}
                      />
                      <span className="font-mono text-[12px] text-ink tabular">
                        {category.count}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-panel bg-card p-6 shadow-ring">
      <h2 className="t-h3">{title}</h2>
      <dl className="mt-5 grid grid-cols-2 items-end gap-x-6 gap-y-5">
        {children}
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number | string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="t-small mt-1 text-ink-3">{label}</dt>
      <dd
        className={
          typeof value === "string"
            ? "text-[17px] leading-tight text-ink-2"
            : emphasis
              ? "font-mono text-[36px] leading-none tracking-[-0.02em] text-ink tabular"
              : "font-mono text-[22px] leading-none text-ink tabular"
        }
      >
        {value}
      </dd>
    </div>
  );
}
