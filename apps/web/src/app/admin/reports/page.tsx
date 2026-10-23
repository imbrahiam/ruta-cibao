import { WeeklyReportList } from "@/components/admin/weekly/report-list";

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default function AdminReportsPage() {
  return <WeeklyReportList />;
}
