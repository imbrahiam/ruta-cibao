import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ModerationDesk } from "@/components/moderation/moderation-desk";
import { PageBody, PageHeader } from "@/components/shell/page";
import { Placeholder } from "@/components/ui/loading";
import { requirePageMember } from "@/modules/access/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("moderation");
  return { title: t("title") };
}

async function Guard() {
  await requirePageMember("/moderacion");
  return <ModerationDesk />;
}

export default async function ModerationPage() {
  const t = await getTranslations("moderation");
  return (
    <PageBody>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lede={t("lede")} />
      <Suspense fallback={<Placeholder className="h-96" />}>
        <Guard />
      </Suspense>
    </PageBody>
  );
}
