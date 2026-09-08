"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { orpc } from "@/lib/orpc";

/**
 * The weeks that have been counted.
 *
 * A moderator sees their own municipality, an administrator sees all three, and
 * neither is told about the other's — the scope comes from the viewer on the
 * server, so this list has no filter to get wrong.
 */
export function ReportList() {
  const t = useTranslations("reports");
  const format = useFormatter();

  const query = useQuery(orpc.reports.list.queryOptions({ input: {} }));
  const reports = query.data ?? [];

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

  if (reports.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>{t("empty")}</EmptyTitle>
          <EmptyDescription>{t("emptyHint")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const day = { day: "numeric", month: "short" } as const;

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((report) => (
        <li key={report.id}>
          <Link
            href={`/informes/${report.id}`}
            className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{report.municipalityName}</p>
              <p className="text-muted-foreground text-sm">
                {t("week", {
                  start: format.dateTime(new Date(report.periodStart), day),
                  // The stored end is exclusive — the following Monday — so the
                  // label counts back a day to name the Sunday people mean.
                  end: format.dateTime(
                    new Date(new Date(report.periodEnd).getTime() - 86_400_000),
                    day,
                  ),
                })}
              </p>
            </div>

            {report.status === "ready" ? (
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {report.metrics?.places.published ?? 0} ·{" "}
                {report.metrics?.consultations.opened ?? 0}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                {report.status === "failed" ? t("failed") : t("pending")}
              </Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
