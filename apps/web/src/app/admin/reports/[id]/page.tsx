import { WeeklyReportDetail } from "@/components/admin/weekly/report-detail";

export default async function AdminReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WeeklyReportDetail reportId={id} />;
}
