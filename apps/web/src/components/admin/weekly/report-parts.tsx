"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { InlineError } from "@/components/admin/error-panel";
import { useOutcome } from "@/components/admin/outcome";
import { useStaffMutation } from "@/components/admin/use-staff-mutation";
import { Button, buttonStyles } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { api, orpc } from "@/lib/web/api";
import { cx } from "@/lib/web/cx";

export type ReportStatus = "pending" | "ready" | "failed";

/** How long a rendering is awaited: every 4 s, about 30 s in all. */
const POLL_INTERVAL_MS = 4000;
const POLL_ATTEMPTS = 8;

/** "Semana del 12 al 18 de octubre", from the half-open period a report covers. */
export function useWeekLabel() {
  const reports = useTranslations("reports");
  const format = useFormatter();
  return useCallback(
    (report: { periodStart: string; periodEnd: string }) =>
      reports("week", {
        start: format.dateTime(new Date(report.periodStart), {
          day: "numeric",
          month: "short",
        }),
        // The period ends at the next Monday's midnight: the last day shown
        // is the Sunday before it.
        end: format.dateTime(
          new Date(new Date(report.periodEnd).getTime() - 1),
          "short",
        ),
      }),
    [format, reports],
  );
}

const STATUS_TONE = {
  pending: "warning",
  ready: "success",
  failed: "danger",
} as const;

/** Generation state of a report, always as text. */
export function ReportStatusTag({ status }: { status: ReportStatus }) {
  const reports = useTranslations("reports.statuses");
  return <Tag tone={STATUS_TONE[status]}>{reports(status)}</Tag>;
}

type PdfState =
  | { phase: "idle" }
  | { phase: "working"; queued: boolean }
  | { phase: "ready"; url: string }
  | { phase: "pending" }
  | { phase: "failed"; error?: unknown };

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the PDF of one report.
 *
 * A ready report downloads: the link is signed and expires, so it is fetched
 * fresh on click and opened in a new tab. When there is no file yet, or the
 * report failed, the render is requested and the detail polled every few
 * seconds until a link appears; the link is then offered as a button, because a
 * tab opened half a minute after the tap would be blocked.
 */
export function PdfActions({
  reportId,
  status,
  label,
  inline = false,
}: {
  reportId: string;
  status: ReportStatus;
  /** Municipality and week, so repeated buttons are told apart by a screen reader. */
  label: { municipality: string; week: string };
  /** Buttons sit side by side from `sm` up instead of filling the width. */
  inline?: boolean;
}) {
  const t = useTranslations("admin");
  const w = useTranslations("admin.weeklyReport");
  const reports = useTranslations("reports");
  const announce = useOutcome();
  const queryClient = useQueryClient();
  const [state, setState] = useState<PdfState>({ phase: "idle" });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const render = useStaffMutation<
    { reportId: string },
    { queued: "queued" | "inline" | "failed" }
  >((input) => api.reports.render({ reportId: input.reportId }));

  const fetchUrl = async () => {
    const detail = await queryClient.fetchQuery({
      ...orpc.reports.detail.queryOptions({ input: { reportId } }),
      staleTime: 0,
    });
    return detail.pdfUrl;
  };

  const poll = async () => {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(POLL_INTERVAL_MS);
      if (!alive.current) return null;
      const url = await fetchUrl();
      if (url) return url;
    }
    return null;
  };

  const requestRender = async () => {
    const result = await render.mutateAsync({ reportId });
    if (result.queued === "failed") {
      setState({ phase: "failed" });
      return;
    }
    setState({ phase: "working", queued: true });
    const url = await poll();
    if (!alive.current) return;
    if (url) {
      setState({ phase: "ready", url });
      announce(w("pdfReady"));
    } else {
      setState({ phase: "pending" });
    }
  };

  const download = async () => {
    setState({ phase: "working", queued: false });
    // The tab is opened inside the tap, before any await, or the browser
    // treats it as a pop-up; it is pointed at the signed link afterwards.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const url = await fetchUrl();
      if (url) {
        if (tab) {
          tab.location.href = url;
          setState({ phase: "idle" });
        } else {
          setState({ phase: "ready", url });
        }
        return;
      }
      tab?.close();
      await requestRender();
    } catch (error) {
      tab?.close();
      if (alive.current) setState({ phase: "failed", error });
    }
  };

  const retry = async () => {
    setState({ phase: "working", queued: false });
    try {
      await requestRender();
    } catch (error) {
      if (alive.current) setState({ phase: "failed", error });
    }
  };

  const working = state.phase === "working";

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cx(
          "flex flex-col gap-2",
          inline && "sm:flex-row sm:flex-wrap sm:items-center",
        )}
      >
        {state.phase === "ready" ? (
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(
              buttonStyles({ variant: "accent", size: "md", block: !inline }),
              "max-md:min-h-11",
              inline && "max-sm:w-full",
            )}
          >
            <Download aria-hidden />
            {t("download")}
          </a>
        ) : status === "ready" ? (
          <Button
            variant="primary"
            block={!inline}
            className={cx("max-md:min-h-11", inline && "max-sm:w-full")}
            disabled={working}
            aria-label={w("downloadFor", label)}
            onClick={download}
          >
            <Download aria-hidden />
            {working ? reports("preparingPdf") : t("download")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            block={!inline}
            className={cx("max-md:min-h-11", inline && "max-sm:w-full")}
            disabled={working}
            aria-label={w("renderFor", label)}
            onClick={retry}
          >
            <FileText aria-hidden />
            {working ? reports("preparingPdf") : t("render")}
          </Button>
        )}
      </div>

      <div role="status" aria-live="polite" className="t-small text-ink-2">
        {state.phase === "working" && state.queued ? t("queued") : null}
        {state.phase === "ready" ? w("pdfReady") : null}
        {state.phase === "pending" ? w("pdfStillPending") : null}
      </div>
      {state.phase === "failed" ? (
        state.error ? (
          <InlineError error={state.error} />
        ) : (
          <p role="alert" className="t-small text-danger-ink">
            {reports("pdfFailed")}
          </p>
        )
      ) : null}
    </div>
  );
}
