"use client";

import { FileText } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "use-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useWeekRange } from "./report-parts";

/** Santo Domingo keeps UTC−4 all year (no daylight saving). */
const OFFSET_MS = -4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The last completed week, Monday to Monday in Santo Domingo: the one the
 * server generates (`previousWeekStart` in `modules/reports/weekly.ts`).
 */
function lastCompletedWeek(now = new Date()) {
  const local = new Date(now.getTime() + OFFSET_MS);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  const monday =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - sinceMonday,
    ) - OFFSET_MS;
  return {
    periodStart: new Date(monday - 7 * DAY_MS),
    periodEnd: new Date(monday),
  };
}

/**
 * "Generar informe…": says which week and which towns before anything is
 * generated, since with "all authorised" selected one tap covers several.
 */
export function GenerateReports({
  municipalities,
  pending,
  onConfirm,
}: {
  /** Names of the towns that would get a report. */
  municipalities: string[];
  pending: boolean;
  onConfirm: () => void;
}) {
  const w = useTranslations("admin.weeklyReport");
  const reports = useTranslations("reports");
  const common = useTranslations("common");
  const weekRange = useWeekRange();
  const week = useMemo(() => weekRange(lastCompletedWeek()), [weekRange]);
  const count = municipalities.length;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={pending || count === 0}>
          <FileText aria-hidden />
          {pending ? reports("preparingPdf") : w("generateOpen")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{w("generateTitle", { count })}</AlertDialogTitle>
          <AlertDialogDescription>{w("generateHint")}</AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{w("generateWeek")}</dt>
          <dd className="font-medium">{week}</dd>
          <dt className="text-muted-foreground">
            {w("generateMunicipalities", { count })}
          </dt>
          <dd className="font-medium">{municipalities.join(", ")}</dd>
        </dl>
        <AlertDialogFooter>
          <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {w("generateConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
