import { Suspense } from "react";
import { ConsultationDetail } from "@/components/consultations/consultation-detail";
import { PageBody } from "@/components/shell/page";
import { Placeholder } from "@/components/ui/loading";

async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ConsultationDetail slug={decodeURIComponent(slug)} />;
}

export default function ConsultationPage({
  params,
}: PageProps<"/[locale]/consultas/[slug]">) {
  return (
    <PageBody className="pt-6 md:pt-12">
      <Suspense fallback={<Placeholder className="h-96" />}>
        <Detail params={params} />
      </Suspense>
    </PageBody>
  );
}
