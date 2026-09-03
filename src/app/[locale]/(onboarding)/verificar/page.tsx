import { asc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CedulaForm } from "@/components/onboarding/cedula-form";
import {
  VerificationStatus,
  VerificationStatusFallback,
} from "@/components/onboarding/verification-status";
import { BlurFade } from "@/components/ui/blur-fade";
import { db } from "@/db";
import { municipalities } from "@/db/schema";

/**
 * The municipality list changes about once a decade, so it is cached and lands
 * in the static shell. The form is therefore fully rendered before anyone
 * clicks — there is nothing to wait for and nothing to fake with a skeleton.
 */
async function loadMunicipalities() {
  "use cache";
  return db
    .select({ id: municipalities.id, name: municipalities.name })
    .from(municipalities)
    .orderBy(asc(municipalities.name));
}

export default async function VerifyPage({
  params,
}: PageProps<"/[locale]/verificar">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "onboarding.cedula" });
  const list = await loadMunicipalities();

  return (
    <>
      <BlurFade delay={0.05} inView>
        <header className="flex flex-col gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("intro")}
          </p>
        </header>
      </BlurFade>

      {/* The only per-person part of this page. It streams into place while the
          form above is already usable, instead of holding the page back. */}
      <Suspense fallback={<VerificationStatusFallback />}>
        <VerificationStatus />
      </Suspense>

      <BlurFade delay={0.1} inView>
        <CedulaForm municipalities={list} />
      </BlurFade>
    </>
  );
}
