import { adminPageMetadata } from "@/app/admin/page-metadata";
import { CategoryManager } from "@/components/admin/categories/category-manager";

export const metadata = adminPageMetadata("/admin/categories");

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default function AdminCategoriesPage() {
  return <CategoryManager />;
}
