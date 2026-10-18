import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResidencyChoice } from "@/components/onboarding/residency-choice";
import { Placeholder } from "@/components/ui/loading";
import { safeCallbackPath } from "@/modules/access/route-policy";
import { requirePageMember } from "@/modules/access/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

async function Fork({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeCallbackPath((await searchParams).next, "/mapa");
  const viewer = await requirePageMember(
    `/bienvenida?next=${encodeURIComponent(next)}`,
  );
  if (viewer.kind === "citizen" || viewer.profile.residencyDeclaredAt) {
    redirect(next === "/bienvenida" ? "/mapa" : next);
  }
  return <ResidencyChoice next={next} />;
}

export default async function WelcomePage({
  searchParams,
}: PageProps<"/[locale]/bienvenida">) {
  const t = await getTranslations("onboarding");
  return (
    <div className="stagger flex flex-col gap-8">
      <header>
        <p className="t-label text-ink-3">{t("eyebrow")}</p>
        <h1 className="t-h2 mt-3 text-ink">{t("title")}</h1>
        <p className="t-body-lg mt-3 text-ink-2">{t("chooseTier")}</p>
      </header>
      <Suspense fallback={<Placeholder className="h-72 rounded-panel" />}>
        <Fork searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
