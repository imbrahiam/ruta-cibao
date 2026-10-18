import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RouteDirectory } from "@/components/routes/route-directory";
import { PageBody, PageHeader } from "@/components/shell/page";
import { ButtonLink } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/loading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("routes");
  return { title: t("title") };
}

export default async function RoutesPage() {
  const t = await getTranslations("routes");
  return (
    <PageBody>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lede={t("lede")}
        actions={
          <ButtonLink href="/rutas?proponer=1" variant="primary">
            {t("propose")}
          </ButtonLink>
        }
      />
      <Suspense fallback={<Placeholder className="h-96" />}>
        <RouteDirectory />
      </Suspense>
    </PageBody>
  );
}
