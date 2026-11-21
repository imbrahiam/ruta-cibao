import { adminPageMetadata } from "@/app/admin/page-metadata";
import { AdminOverview } from "@/components/admin/overview";

export const metadata = adminPageMetadata("/admin");

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default function AdminHomePage() {
  return <AdminOverview />;
}
