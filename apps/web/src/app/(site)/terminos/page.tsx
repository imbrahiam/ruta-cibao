import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getT } from "@/lib/web/i18n";

const t = getT("landing");

export const metadata: Metadata = {
  title: t("terms"),
  description: t("termsIntro"),
};

const SECTIONS = ["community", "safety", "review", "source"] as const;

export default function TermsPage() {
  return (
    <LegalPage
      title={t("termsTitle")}
      lead={t("termsIntro")}
      sections={SECTIONS.map((key) => ({
        title: t(`termsSections.${key}.title`),
        body: t(`termsSections.${key}.body`),
      }))}
    />
  );
}
