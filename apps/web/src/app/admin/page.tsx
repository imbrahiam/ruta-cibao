import { AdminOverview } from "@/components/admin/overview";

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default function AdminHomePage() {
  return <AdminOverview />;
}
