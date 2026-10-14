"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { client, orpc } from "@/lib/orpc";

/**
 * One week, in figures.
 *
 * This page is the report. The PDF is this page printed by a headless browser,
 * so there is exactly one layout to keep correct and no way for the file an
 * official forwards to disagree with the screen they read it on.
 *
 * Which is why the print rules are here rather than in a separate stylesheet:
 * the chrome — the back link, the buttons — is `print:hidden`, and everything
 * else is already a printable document.
 */
type Metrics = NonNullable<
  Awaited<ReturnType<typeof client.reports.detail>>["metrics"]
>;

/**
 * One figure.
 *
 * The number is the size of a headline because it is the content; the label is
 * small because it is a caption. `NumberTicker` counts up on screen and settles
 * on the real value — it honours `prefers-reduced-motion`, and the value is in
 * the DOM either way, so nothing here depends on the animation running.
 */
function Figure({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 print:border-neutral-300">
      <p className="font-semibold text-2xl tabular-nums">
        <NumberTicker value={value} className="text-2xl tracking-tight" />
        {suffix}
      </p>
      <p className="mt-1 text-muted-foreground text-xs leading-snug">{label}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex break-inside-avoid flex-col gap-3">
      <h2 className="font-semibold text-lg tracking-tight">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
    </section>
  );
}

export function ReportView({ reportId }: { reportId: string }) {
  const t = useTranslations("reports");
  const m = useTranslations("reports.metrics");
  const s = useTranslations("reports.sections");
  const format = useFormatter();
  // Present only when a headless browser loaded this page to print it. A person
  // never has one, and the procedure ignores an invalid one.

  const query = useQuery({
    ...orpc.reports.detail.queryOptions({ input: { reportId } }),
    refetchInterval: (query) =>
      query.state.data && !query.state.data.pdfUrl ? 5000 : false,
  });

  const render = useMutation({
    mutationFn: () => client.reports.render({ reportId }),
    onSuccess: () => toast.success(t("pdfQueued")),
    onError: () => toast.error(t("pdfFailed")),
  });

  if (query.isPending) {
    return (
      <p
        className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm"
        role="status"
      >
        <Spinner className="size-4" /> {t("loading")}
      </p>
    );
  }

  if (query.isError || !query.data) {
    return (
      <p role="alert" className="text-muted-foreground text-sm">
        {t("notFound")}
      </p>
    );
  }

  const report = query.data;
  const metrics: Metrics | null = report.metrics;
  const day = { day: "numeric", month: "long" } as const;

  return (
    <div className="flex flex-col gap-8">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 self-start print:hidden"
        nativeButton={false}
        render={<Link href="/informes" />}
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl tracking-tight">
            {report.municipalityName}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("week", {
              start: format.dateTime(new Date(report.periodStart), day),
              end: format.dateTime(
                new Date(new Date(report.periodEnd).getTime() - 86_400_000),
                day,
              ),
            })}
          </p>
          {report.generatedAt && (
            <p className="text-muted-foreground text-xs">
              {t("generatedAt", {
                date: format.dateTime(new Date(report.generatedAt), "short"),
              })}
            </p>
          )}
        </div>

        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            {t("print")}
          </Button>

          {report.pdfUrl ? (
            <Button
              nativeButton={false}
              render={
                <a href={report.pdfUrl} target="_blank" rel="noreferrer" />
              }
            >
              <Download className="size-4" aria-hidden />
              {t("downloadPdf")}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={render.isPending}
              onClick={() => render.mutate()}
            >
              {render.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              {render.isPending ? t("preparingPdf") : t("downloadPdf")}
            </Button>
          )}
        </div>
      </header>

      <Separator />

      {report.status !== "ready" ? (
        <p role="status" className="text-muted-foreground text-sm">
          {report.status === "failed" ? t("failed") : t("pending")}
        </p>
      ) : !metrics ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t("unreadable")}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <Section title={s("places")}>
            <Figure
              label={m("placesSubmitted")}
              value={metrics.places.submitted}
            />
            <Figure
              label={m("placesPublished")}
              value={metrics.places.published}
            />
            <Figure
              label={m("placesRejected")}
              value={metrics.places.rejected}
            />
            <Figure label={m("placesTotal")} value={metrics.places.total} />
          </Section>

          <Section title={s("traffic")}>
            <Figure
              label={m("trafficReported")}
              value={metrics.traffic.reported}
            />
            <Figure
              label={m("trafficCleared")}
              value={metrics.traffic.cleared}
            />
            <Figure
              label={m("trafficExpired")}
              value={metrics.traffic.expired}
            />
            <Figure
              label={m("trafficRemoved")}
              value={metrics.traffic.removed}
            />
          </Section>

          <Section title={s("consultations")}>
            <Figure
              label={m("consultationsOpened")}
              value={metrics.consultations.opened}
            />
            <Figure
              label={m("consultationsAnswered")}
              value={metrics.consultations.answered}
            />
            <Figure
              label={m("consultationsResolved")}
              value={metrics.consultations.resolved}
            />
            {/* The figure the ayuntamiento is answerable for, so it is not
                buried among the others: how many neighbours are still waiting. */}
            <Figure
              label={m("consultationsStillOpen")}
              value={metrics.consultations.stillOpen}
            />
          </Section>

          <section className="flex break-inside-avoid flex-col gap-3">
            <h2 className="font-semibold text-lg tracking-tight">
              {m("medianResponse")}
            </h2>
            <p className="font-semibold text-2xl tabular-nums">
              {metrics.consultations.medianResponseHours === null
                ? m("medianResponseNone")
                : m("medianResponseHours", {
                    hours: metrics.consultations.medianResponseHours,
                  })}
            </p>
          </section>

          <Section title={s("businesses")}>
            <Figure
              label={m("businessesClaimed")}
              value={metrics.businesses.claimed}
            />
            <Figure
              label={m("businessesApproved")}
              value={metrics.businesses.approved}
            />
            <Figure
              label={m("peopleVerified")}
              value={metrics.people.verified}
            />
            <Figure
              label={m("peopleContributors")}
              value={metrics.people.contributors}
            />
          </Section>

          <section className="flex break-inside-avoid flex-col gap-3">
            <h2 className="font-semibold text-lg tracking-tight">
              {s("topCategories")}
            </h2>
            {metrics.topCategories.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noActivity")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {metrics.topCategories.map((category) => (
                  <li
                    key={category.name}
                    className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3 print:border-neutral-300"
                  >
                    <span className="text-sm">{category.name}</span>
                    <span className="font-medium text-sm tabular-nums">
                      {category.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
