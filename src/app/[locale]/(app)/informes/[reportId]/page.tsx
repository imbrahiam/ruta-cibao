import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ReportView } from "@/components/reports/report-view";
import { Spinner } from "@/components/ui/spinner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

/**
 * One weekly report.
 *
 * The access check lives in `reports.detail`, not here, and that is deliberate:
 * this page is also what the PDF renderer loads, and a redirect to sign-in
 * would render a login screen into the file. The procedure refuses the data;
 * the page renders whatever it is given.
 */
async function Report({
  params,
}: {
  params: PageProps<"/[locale]/informes/[reportId]">["params"];
}) {
  const { reportId } = await params;
  return <ReportView reportId={reportId} />;
}

export default function ReportPage({
  params,
}: PageProps<"/[locale]/informes/[reportId]">) {
  return (
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
      <Report params={params} />
    </Suspense>
  );
}
