import { getTranslations } from "next-intl/server";
import { ContributionList } from "@/components/account/contribution-list";

export async function generateMetadata() {
  const t = await getTranslations("navigation");
  return { title: t("contributions") };
}

export default function ContributionsPage() {
  return <ContributionList />;
}
