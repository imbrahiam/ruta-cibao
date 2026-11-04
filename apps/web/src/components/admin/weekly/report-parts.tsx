"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { InlineError } from "@/components/admin/error-panel";
import { useOutcome } from "@/components/admin/outcome";
import { StatusIndicator } from "@/components/admin/status-indicator";
import { useStaffMutation } from "@/components/admin/use-staff-mutation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api, orpc } from "@/lib/web/api";

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

/** Generation state of a report: a dot and always the word. */
export function ReportStatusIndicator({ status }: { status: ReportStatus }) {
  const reports = useTranslations("reports.statuses");
  return (
    <StatusIndicator tone={STATUS_TONE[status]}>
      {reports(status)}
    </StatusIndicator>
  );
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
  placement,
}: {
  reportId: string;
  status: ReportStatus;
  /** Municipality and week, so repeated buttons are told apart by a screen reader. */
  label: { municipality: string; week: string };
  /** `row` is one compact button in a table row; `page` the header action. */
  placement: "row" | "page";
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
  const row = placement === "row";
  // In a row the button is an icon until there is room for its word.
  const buttonClass = row ? "xl:w-auto xl:px-4" : undefined;
  const text = (word: string) =>
    row ? <span className="hidden xl:inline">{word}</span> : word;
  const size = row ? "icon" : "default";
  const variant = row ? "outline" : "default";

  return (
    <div
      className={cn(
        "flex flex-col gap-0",
        row ? "items-end" : "items-start sm:items-end",
      )}
    >
      {state.phase === "ready" ? (
        <Button asChild variant={variant} size={size} className={buttonClass}>
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={w("downloadFor", label)}
          >
            <Download aria-hidden />
            {text(t("download"))}
          </a>
        </Button>
      ) : status === "ready" ? (
        <Button
          variant={variant}
          size={size}
          className={buttonClass}
          disabled={working}
          aria-busy={working}
          aria-label={w("downloadFor", label)}
          title={w("downloadFor", label)}
          onClick={download}
        >
          <Download aria-hidden />
          {text(working ? reports("preparingPdf") : t("download"))}
        </Button>
      ) : (
        <Button
          variant="outline"
          size={size}
          className={buttonClass}
          disabled={working}
          aria-busy={working}
          aria-label={w("renderFor", label)}
          title={w("renderFor", label)}
          onClick={retry}
        >
          <FileText aria-hidden />
          {text(working ? reports("preparingPdf") : t("render"))}
        </Button>
      )}

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "max-w-60 text-xs text-muted-foreground not-empty:mt-1.5 whitespace-normal",
          row ? "text-right" : "text-left sm:text-right",
        )}
      >
        {state.phase === "working" && state.queued ? t("queued") : null}
        {state.phase === "ready" ? w("pdfReady") : null}
        {state.phase === "pending" ? w("pdfStillPending") : null}
      </div>
      {state.phase === "failed" ? (
        state.error ? (
          <InlineError error={state.error} />
        ) : (
          <p
            role="alert"
            className="mt-1.5 max-w-60 text-xs whitespace-normal text-destructive"
          >
            {reports("pdfFailed")}
          </p>
        )
      ) : null}
    </div>
  );
}
