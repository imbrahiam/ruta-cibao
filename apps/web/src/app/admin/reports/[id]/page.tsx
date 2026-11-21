import { adminPageMetadata } from "@/app/admin/page-metadata";
import { WeeklyReportDetail } from "@/components/admin/weekly/report-detail";

export const metadata = adminPageMetadata("/admin/reports");

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default async function AdminReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WeeklyReportDetail reportId={id} />;
}
