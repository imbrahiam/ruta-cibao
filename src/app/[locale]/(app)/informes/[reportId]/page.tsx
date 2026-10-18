import { Suspense } from "react";
import { ReportView } from "@/components/reports/report-view";
import { PageBody } from "@/components/shell/page";
import { Placeholder } from "@/components/ui/loading";
import { requirePageMember } from "@/modules/access/server";

async function Report({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  await requirePageMember(`/informes/${reportId}`);
  return <ReportView reportId={reportId} />;
}

export default function ReportPage({
  params,
}: PageProps<"/[locale]/informes/[reportId]">) {
  return (
    <PageBody className="pt-6 md:pt-12">
      <Suspense fallback={<Placeholder className="h-96" />}>
        <Report params={params} />
      </Suspense>
    </PageBody>
  );
}
