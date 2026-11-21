import { adminPageMetadata } from "@/app/admin/page-metadata";
import { WeeklyReportList } from "@/components/admin/weekly/report-list";

export const metadata = adminPageMetadata("/admin/reports");

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default function AdminReportsPage() {
  return <WeeklyReportList />;
}
