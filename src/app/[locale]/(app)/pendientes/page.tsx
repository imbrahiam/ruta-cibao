import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PendingList } from "@/components/account/pending-list";
import { PageBody, PageHeader } from "@/components/shell/page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pending");
  return { title: t("title") };
}

export default async function PendingPage() {
  const t = await getTranslations("pending");
  return (
    <PageBody className="max-w-[880px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lede={t("lede")} />
      <PendingList />
    </PageBody>
  );
}
