import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getT } from "@/lib/web/i18n";

const t = getT("landing");

export const metadata: Metadata = {
  title: t("support"),
  description: t("supportIntro"),
};

export default function SupportPage() {
  return (
    <LegalPage
      title={t("supportTitle")}
      lead={t("supportIntro")}
      sections={[
        { title: t("supportContactTitle"), body: t("supportContact") },
        { title: t("supportSafetyTitle"), body: t("supportSafety") },
      ]}
    />
  );
}
