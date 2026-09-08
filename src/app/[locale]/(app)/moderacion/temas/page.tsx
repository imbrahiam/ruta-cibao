import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CategoryManager } from "@/components/catalog/category-manager";
import { requirePageMember } from "@/modules/access/server";

async function AdminCategories() {
  const viewer = await requirePageMember("/moderacion/temas");
  const t = await getTranslations("moderation");
  if (viewer.kind !== "citizen" || viewer.profile.staffRole !== "admin")
    return <p role="alert">{t("noAccess")}</p>;
  return <CategoryManager />;
}
export default function Page() {
  return (
    <Suspense>
      <AdminCategories />
    </Suspense>
  );
}
