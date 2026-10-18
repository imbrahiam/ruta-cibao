import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageBody, PageHeader } from "@/components/shell/page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

const SECTIONS = [
  "identity",
  "account",
  "location",
  "passport",
  "device",
  "providers",
] as const;

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <PageBody className="max-w-[880px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lede={t("intro")} />
      <div className="flex flex-col divide-y divide-line/70">
        {SECTIONS.map((key) => (
          <section
            key={key}
            className="grid gap-2 py-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10"
          >
            <h2 className="text-[17px] font-medium tracking-[-0.012em] text-ink">
              {t(`${key}Title`)}
            </h2>
            <p className="t-body max-w-[60ch] text-ink-2">{t(`${key}Body`)}</p>
          </section>
        ))}
      </div>
    </PageBody>
  );
}
