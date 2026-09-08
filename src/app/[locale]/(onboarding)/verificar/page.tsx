import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CedulaForm } from "@/components/onboarding/cedula-form";
import {
  VerificationStatus,
  VerificationStatusFallback,
} from "@/components/onboarding/verification-status";
import { BlurFade } from "@/components/ui/blur-fade";
import { db } from "@/db";
import { municipalities } from "@/db/schema";
import { safeCallbackPath } from "@/modules/access/route-policy";
import { getServerViewer, requirePageMember } from "@/modules/access/server";

/**
 * The municipality list changes about once a decade, so it is cached. The
 * authenticated page can reuse it without tying that reference data to a
 * session.
 */
async function loadMunicipalities() {
  "use cache";
  return db
    .select({ id: municipalities.id, name: municipalities.name })
    .from(municipalities)
    .orderBy(asc(municipalities.name));
}

async function ProtectedVerifyPage({ next }: { next: string }) {
  await requirePageMember("/verificar");
  // Nothing left to do here: sending a verified resident back into the form
  // is how they ended up staring at two success messages and no way forward.
  const viewer = await getServerViewer();
  if (viewer.kind === "citizen") redirect(next);

  const t = await getTranslations("onboarding.cedula");
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

      {/* This second read is deduplicated by the request-scoped viewer cache. */}
      <Suspense fallback={<VerificationStatusFallback />}>
        <VerificationStatus />
      </Suspense>

      <BlurFade delay={0.1} inView>
        <CedulaForm municipalities={list} next={next} />
      </BlurFade>
    </>
  );
}

export default function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense fallback={<VerificationStatusFallback />}>
      <VerifyPageWithNext searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyPageWithNext({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeCallbackPath((await searchParams).next);
  return <ProtectedVerifyPage next={next} />;
}
