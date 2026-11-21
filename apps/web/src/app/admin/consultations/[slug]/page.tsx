import { adminPageMetadata } from "@/app/admin/page-metadata";
import { CaseDetail } from "@/components/admin/cases/case-detail";

export const metadata = adminPageMetadata("/admin/consultations");

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
