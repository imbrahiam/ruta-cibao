import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline");
  return { title: t("pageTitle") };
}

/**
 * What the service worker shows when a page cannot load. Precached, so it
 * carries nothing personal: no account menu, no data, just the way back.
 */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  const tApp = await getTranslations("app");
  return (
    <main
      id="contenido"
      className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 py-16 text-center"
    >
      <Logo label={tApp("name")} />
      <span className="mt-12 flex size-14 items-center justify-center rounded-full bg-paper-3 text-ink-2">
        <WifiOff strokeWidth={1.5} className="size-6" />
      </span>
      <h1 className="t-h2 mt-6 max-w-[20ch]">{t("pageTitle")}</h1>
      <p className="t-body-lg mt-3 max-w-[44ch] text-ink-2">{t("pageBody")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/mapa" variant="primary">
          {t("openMap")}
        </ButtonLink>
        <ButtonLink href="/pendientes" variant="secondary">
          {t("pending")}
        </ButtonLink>
      </div>
    </main>
  );
}
