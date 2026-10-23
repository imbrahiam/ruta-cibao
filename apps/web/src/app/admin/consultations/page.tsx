import { CaseList } from "@/components/admin/cases/case-list";

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default function AdminConsultationsPage() {
  return <CaseList />;
}
