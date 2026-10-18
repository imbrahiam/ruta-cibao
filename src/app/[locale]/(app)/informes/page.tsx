import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ReportList } from "@/components/reports/report-list";
import { PageBody, PageHeader } from "@/components/shell/page";
import { Placeholder } from "@/components/ui/loading";
import { requirePageMember } from "@/modules/access/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

async function Guard() {
  await requirePageMember("/informes");
  return <ReportList />;
}

export default async function ReportsPage() {
  const t = await getTranslations("reports");
  return (
    <PageBody>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lede={t("intro")} />
      <Suspense fallback={<Placeholder className="h-72" />}>
        <Guard />
      </Suspense>
    </PageBody>
  );
}
