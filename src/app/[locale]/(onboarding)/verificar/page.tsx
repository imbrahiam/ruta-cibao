import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { VerificationFlow } from "@/components/onboarding/verification-flow";
import { VerificationStatusFallback } from "@/components/onboarding/verification-status";
import { db } from "@/db";
import { municipalities } from "@/db/schema";
import { requireMember } from "@/modules/access/permissions";
import { safeCallbackPath } from "@/modules/access/route-policy";
import { getServerViewer, requirePageMember } from "@/modules/access/server";
import { verificationStatus } from "@/modules/identity/status";

export async function generateMetadata() {
  const t = await getTranslations("identity");
  return { title: t("title") };
}

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

  const list = await loadMunicipalities();
  const status = await verificationStatus(requireMember(viewer));
  return (
    <VerificationFlow
      initialStatus={status}
      municipalities={list}
      next={next}
    />
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
