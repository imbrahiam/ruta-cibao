import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CategoryManager } from "@/components/moderation/category-manager";
import { PageBody, PageHeader } from "@/components/shell/page";
import { Placeholder } from "@/components/ui/loading";
import { requirePageMember } from "@/modules/access/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog");
  return { title: t("title") };
}

async function Guard() {
  await requirePageMember("/moderacion/temas");
  return <CategoryManager />;
}

export default async function CategoriesPage() {
  const t = await getTranslations("catalog");
  return (
    <PageBody>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lede={t("lede")} />
      <Suspense fallback={<Placeholder className="h-96" />}>
        <Guard />
      </Suspense>
    </PageBody>
  );
}
