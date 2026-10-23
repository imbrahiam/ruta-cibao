import { CaseDetail } from "@/components/admin/cases/case-detail";

export default async function AdminConsultationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CaseDetail slug={slug} />;
}
