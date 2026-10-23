import type { Metadata } from "next";
import { Suspense } from "react";
import { DeleteAccountFlow } from "@/components/site/delete-account-form";
import { LegalPage } from "@/components/site/legal-page";
import { getT, pickMessages } from "@/lib/web/i18n";

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
    >
      <Suspense>
        <DeleteAccountFlow
          messages={pickMessages(["landing", "admin", "common", "errors"])}
        />
      </Suspense>
    </LegalPage>
  );
}
