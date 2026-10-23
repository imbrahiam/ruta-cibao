import { CaseDetail } from "@/components/admin/cases/case-detail";

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default async function AdminConsultationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CaseDetail slug={slug} />;
}
