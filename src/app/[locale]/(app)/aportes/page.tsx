import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ContributionList } from "@/components/account/contribution-list";
import { PageBody, PageHeader } from "@/components/shell/page";
import { ButtonLink } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/loading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contributions");
  return { title: t("title") };
}

export default async function ContributionsPage() {
  const t = await getTranslations("contributions");
  return (
    <PageBody className="max-w-[880px]">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lede={t("lede")}
        actions={
          <ButtonLink href="/mapa?reportar=lugar" variant="primary">
            {t("add")}
          </ButtonLink>
        }
      />
      <Suspense fallback={<Placeholder className="h-72" />}>
        <ContributionList />
      </Suspense>
    </PageBody>
  );
}
