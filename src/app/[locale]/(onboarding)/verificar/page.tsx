import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { VerificationFlow } from "@/components/onboarding/verification-flow";
import { Placeholder } from "@/components/ui/loading";
import { db } from "@/db";
import { municipalities } from "@/db/schema";
import { safeCallbackPath } from "@/modules/access/route-policy";
import { requirePageMember } from "@/modules/access/server";
import { verificationStatus } from "@/modules/identity/status";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("identity");
  return { title: t("title") };
}

/** Municipalities change about once a decade; cached apart from any session. */
async function loadMunicipalities() {
  "use cache";
  return db
    .select({ id: municipalities.id, name: municipalities.name })
    .from(municipalities)
    .orderBy(asc(municipalities.name));
}

async function Flow({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeCallbackPath((await searchParams).next, "/cuenta");
  const viewer = await requirePageMember("/verificar");
  if (viewer.kind === "citizen") redirect(next);
  const [list, status] = await Promise.all([
    loadMunicipalities(),
    verificationStatus(viewer),
  ]);
  return (
    <VerificationFlow
      initialStatus={status}
      municipalities={list}
      next={next}
    />
  );
}

export default async function VerifyPage({
  searchParams,
}: PageProps<"/[locale]/verificar">) {
  const t = await getTranslations("identity");
  return (
    <div className="stagger flex flex-col gap-8">
      <header>
        <p className="t-label text-ink-3">{t("eyebrow")}</p>
        <h1 className="t-h2 mt-3 text-ink">{t("title")}</h1>
        <p className="t-body-lg mt-3 text-ink-2">{t("intro")}</p>
      </header>
      <Suspense fallback={<Placeholder className="h-96 rounded-panel" />}>
        <Flow searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
