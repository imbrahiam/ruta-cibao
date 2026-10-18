import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PassportBook } from "@/components/passport/passport-book";
import { PageBody, PageHeader } from "@/components/shell/page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("passport");
  return { title: t("title") };
}

export default async function PassportPage() {
  const t = await getTranslations("passport");
  return (
    <PageBody>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lede={t("lede")} />
      <PassportBook />
    </PageBody>
  );
}
