import { Footprints } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PlaceDirectory } from "@/components/explore/place-directory";
import { PageBody, PageHeader } from "@/components/shell/page";
import { ButtonLink } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/loading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("explore");
  return { title: t("title") };
}

export default async function ExplorePage() {
  const t = await getTranslations("explore");
  return (
    <PageBody>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lede={t("lede")}
        actions={
          <ButtonLink href="/rutas" variant="secondary">
            <Footprints strokeWidth={1.5} />
            {t("routesLink")}
          </ButtonLink>
        }
      />
      <Suspense fallback={<Placeholder className="h-96" />}>
        <PlaceDirectory />
      </Suspense>
    </PageBody>
  );
}
