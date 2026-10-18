import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IdentityDesk } from "@/components/moderation/identity-desk";
import { PageBody, PageHeader } from "@/components/shell/page";
import { Placeholder } from "@/components/ui/loading";
import { requirePageMember } from "@/modules/access/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("identity.desk");
  return { title: t("title") };
}

async function Guard() {
  await requirePageMember("/moderacion/identidad");
  return <IdentityDesk />;
}

export default async function IdentityReviewPage() {
  const t = await getTranslations("identity.desk");
  return (
    <PageBody>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lede={t("lede")} />
      <Suspense fallback={<Placeholder className="h-96" />}>
        <Guard />
      </Suspense>
    </PageBody>
  );
}
