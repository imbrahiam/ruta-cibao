import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ConsultationDetail } from "@/components/consultations/consultation-detail";
import { Spinner } from "@/components/ui/spinner";

/**
 * One case.
 *
 * The title is generic rather than the case's own. Resolving it here would mean
 * a database round trip on a page whose content already streams from the
 * client, and a case title in a browser tab is not worth making the shell
 * dynamic for.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("consultations");
  return { title: t("title") };
}

async function Case({
  params,
}: {
  params: PageProps<"/[locale]/consultas/[slug]">["params"];
}) {
  const { slug } = await params;
  return <ConsultationDetail slug={slug} />;
}

export default function ConsultationPage({
  params,
}: PageProps<"/[locale]/consultas/[slug]">) {
  return (
    // Reading `params` is a runtime access. Isolating it here is what lets the
    // shell around it — the header, the navigation — prerender.
    <Suspense
      fallback={
        <p
          className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm"
          role="status"
        >
          <Spinner className="size-4" />
        </p>
      }
    >
      <Case params={params} />
    </Suspense>
  );
}
