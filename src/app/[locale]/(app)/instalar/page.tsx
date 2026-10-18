import { BellRing, CloudOff, Zap } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InstallCard } from "@/components/pwa/install-card";
import { PageBody, PageHeader } from "@/components/shell/page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("install");
  return { title: t("title") };
}

export default async function InstallPage() {
  const t = await getTranslations("install");
  const benefits = [
    { icon: Zap, text: t("benefitFast") },
    { icon: CloudOff, text: t("benefitOffline") },
    { icon: BellRing, text: t("benefitAlerts") },
  ];
  return (
    <PageBody className="max-w-[960px]">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lede={t("intro")} />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <InstallCard />
        <ul className="flex flex-col gap-3">
          {benefits.map((benefit) => (
            <li
              key={benefit.text}
              className="flex items-start gap-3 rounded-card bg-paper-2 p-4"
            >
              <benefit.icon
                strokeWidth={1.5}
                className="mt-0.5 size-5 shrink-0 text-ink-2"
              />
              <span className="t-small text-ink">{benefit.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {(["offline", "private"] as const).map((key) => (
          <div key={key} className="rounded-card bg-card p-6 shadow-ring">
            <h2 className="t-h3">{t(`${key}Title`)}</h2>
            <p className="t-body mt-2 text-ink-2">{t(`${key}Body`)}</p>
          </div>
        ))}
      </section>
    </PageBody>
  );
}
