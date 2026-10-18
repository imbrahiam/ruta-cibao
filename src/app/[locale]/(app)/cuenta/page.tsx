import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountScreen } from "@/components/account/account-screen";
import { PageBody, PageHeader } from "@/components/shell/page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountPage");
  return { title: t("title") };
}

export default async function AccountPage() {
  const t = await getTranslations("accountPage");
  return (
    <PageBody>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <AccountScreen />
    </PageBody>
  );
}
