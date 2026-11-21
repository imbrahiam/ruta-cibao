import { adminPageMetadata } from "@/app/admin/page-metadata";
import { CaseList } from "@/components/admin/cases/case-list";

export const metadata = adminPageMetadata("/admin/consultations");

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default function AdminConsultationsPage() {
  return <CaseList />;
}
