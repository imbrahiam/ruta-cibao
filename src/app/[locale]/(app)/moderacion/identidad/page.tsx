import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { IdentityReviews } from "@/components/moderation/identity-reviews";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { requireModerator } from "@/modules/access/permissions";
import { getServerViewer, requirePageMember } from "@/modules/access/server";

export async function generateMetadata() {
  const t = await getTranslations("identity.desk");
  return { title: t("title") };
}

async function Desk() {
  await requirePageMember("/moderacion/identidad");
  const viewer = await getServerViewer();
  const t = await getTranslations("identity.desk");
  if (viewer.kind !== "citizen" || viewer.profile.staffRole === "none") {
    const accessT = await getTranslations("moderation");
    return <p role="alert">{accessT("noAccess")}</p>;
  }
  requireModerator(viewer);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-lede">{t("intro")}</p>
      </header>
      <IdentityReviews />
      <Link
        href="/moderacion"
        className="inline-flex min-h-11 items-center underline underline-offset-4"
      >
        {t("back")}
      </Link>
    </div>
  );
}

export default function IdentityReviewsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Desk />
    </Suspense>
  );
}
