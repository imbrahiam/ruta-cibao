import { CategoryManager } from "@/components/admin/categories/category-manager";

/** Withheld during prerender until `AdminShell` verifies the staff session. */
export const instant = false;

export default function AdminCategoriesPage() {
  return <CategoryManager />;
}
