import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ConsultationList } from "@/components/consultations/consultation-list";
import { PageBody, PageHeader } from "@/components/shell/page";
import { ButtonLink } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/loading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("consultations");
  return { title: t("title") };
}

export default async function ConsultationsPage() {
  const t = await getTranslations("consultations");
  return (
    <PageBody>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lede={t("lede")}
        actions={
          <ButtonLink href="/consultas?abrir=1" variant="primary">
            {t("open")}
          </ButtonLink>
        }
      />
      <Suspense fallback={<Placeholder className="h-96" />}>
        <ConsultationList />
      </Suspense>
    </PageBody>
  );
}
