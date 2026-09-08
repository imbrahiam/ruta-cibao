import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ConsultationList } from "@/components/consultations/consultation-list";
import { Spinner } from "@/components/ui/spinner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("consultations");
  return { title: t("title"), description: t("intro") };
}

async function Loading() {
  const t = await getTranslations("consultations");

  return (
    <p
      className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-4" />
      {t("loading")}
    </p>
  );
}

export default function ConsultationsPage() {
  return (
    // Which filters are on comes from the URL, and reading that is a runtime
    // access. Isolating it here is what lets the rest of the route prerender.
    <Suspense fallback={<Loading />}>
      <ConsultationList />
    </Suspense>
  );
}
