import type { Metadata } from "next";
import { Suspense } from "react";
import { ShareView } from "@/components/share/share-view";
import { Unavailable } from "@/components/share/unavailable";
import { Placeholder } from "@/components/ui/loading";
import { getT } from "@/lib/web/i18n";
import { loadShare, type ShareContent } from "@/lib/web/share";

type Params = Promise<{ kind: string; ref: string }>;

function describe(content: ShareContent): {
  title: string;
  description: string;
} {
  const t = getT("share");
  switch (content.kind) {
    case "place":
      return {
        title: content.data.name,
        description:
          content.data.description?.slice(0, 200) ??
          `${content.data.category.name} · ${content.data.municipality.name}`,
      };
    case "route":
      return {
        title: content.data.name,
        description: content.data.description.slice(0, 200),
      };
    case "consultation":
      return {
        title: content.data.title,
        description: `${content.data.municipalityName} · ${content.data.categoryName}`,
      };
    case "traffic":
      return {
        title: content.data.categoryName,
        description: `${content.data.municipalityName} · ${t("trafficNotice")}`,
      };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { kind, ref } = await params;
  const content = await loadShare(kind, ref);
  const t = getT("share");

  // Nothing is said about what a missing link might have been.
  if (!content) {
    return {
      title: t("unavailableTitle"),
      robots: { index: false, follow: false },
    };
  }

  const { title, description } = describe(content);
  const image =
    content.kind === "place"
      ? (content.data.photos[0] ?? content.data.imageUrl)
      : null;
  return {
    title,
    description,
    // Shared links are for the people they were sent to, not for search.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

async function Content({ params }: { params: Params }) {
  const { kind, ref } = await params;
  const content = await loadShare(kind, ref);
  return content ? <ShareView content={content} /> : <Unavailable />;
}

export default function SharePage({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={
        <div
          className="container-page flex flex-col gap-4 py-16"
          aria-busy="true"
        >
          <Placeholder className="h-10 w-2/3" />
          <Placeholder className="h-64" />
        </div>
      }
    >
      <Content params={params} />
    </Suspense>
  );
}
