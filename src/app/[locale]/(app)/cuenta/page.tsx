import { getTranslations } from "next-intl/server";
import { AccountScreen } from "@/components/account/account-screen";

export async function generateMetadata() {
  const t = await getTranslations("navigation");
  return { title: t("account") };
}

export default function AccountPage() {
  return <AccountScreen />;
}
