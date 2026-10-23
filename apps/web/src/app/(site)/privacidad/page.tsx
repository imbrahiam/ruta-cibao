import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getT } from "@/lib/web/i18n";

const t = getT("landing");

export const metadata: Metadata = {
  title: t("privacy"),
  description: t("privacyIntro"),
};

const SECTIONS = [
  "account",
  "content",
  "permissions",
  "providers",
  "retention",
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      title={t("privacyTitle")}
      lead={t("privacyIntro")}
      sections={SECTIONS.map((key) => ({
        title: t(`privacySections.${key}.title`),
        body: t(`privacySections.${key}.body`),
      }))}
    />
  );
}
