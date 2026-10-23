import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getT } from "@/lib/web/i18n";

const t = getT("landing");

export const metadata: Metadata = {
  title: t("deletion"),
  description: t("deleteIntro"),
};

export default function DeleteAccountPage() {
  return (
    <LegalPage
      title={t("deleteTitle")}
      lead={t("deleteIntro")}
      sections={[
        { title: t("deletion"), body: t("deleteBody") },
        { title: t("deleteWebTitle"), body: t("deleteWebBody") },
        { title: t("deleteOfflineTitle"), body: t("deleteOffline") },
      ]}
    />
  );
}
