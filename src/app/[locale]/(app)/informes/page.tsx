import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ReportList } from "@/components/reports/report-list";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { requirePageMember } from "@/modules/access/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

/**
 * The weekly reports.
 *
 * Guarded here as well as in the procedures behind it. A screen is not a
 * permission — but a moderator who follows a link should get a sentence and a
 * way out rather than an empty list they cannot explain.
 */
async function Reports() {
  const viewer = await requirePageMember("/informes");
  const t = await getTranslations("reports");
  const moderation = await getTranslations("moderation");

  if (viewer.kind !== "citizen" || viewer.profile.staffRole === "none") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/40 p-8 text-center">
        <FileText className="size-7 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">{moderation("noAccess")}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {moderation("noAccessHint")}
          </p>
        </div>
        <Button
          className="h-11"
          nativeButton={false}
          render={<Link href="/mapa" />}
        >
          {moderation("backToMap")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("intro")}
        </p>
      </header>

      <ReportList />
    </div>
  );
}

export default function ReportsPage() {
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
      <Reports />
    </Suspense>
  );
}
