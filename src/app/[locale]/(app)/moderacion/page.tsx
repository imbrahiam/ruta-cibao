import {
  ChevronRight,
  FileText,
  Route,
  ShieldCheck,
  ShieldOff,
  Tags,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ModerationQueue } from "@/components/moderation/moderation-queue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { requirePageMember } from "@/modules/access/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("moderation");
  return { title: t("title") };
}

/**
 * The moderation desk.
 *
 * The page checks authority itself rather than trusting the proxy, which only
 * knows whether a session cookie exists. The procedures behind it check again —
 * a screen is not a permission.
 */
async function Desk() {
  const viewer = await requirePageMember("/moderacion");
  const t = await getTranslations("moderation");

  // A sentence and a way out, not a bare 403. Somebody who followed a link here
  // is more likely to be a resident who should be asking for the role than an
  // attacker, and the procedures refuse them either way.
  if (viewer.kind !== "citizen" || viewer.profile.staffRole === "none") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/40 p-8 text-center">
        <ShieldOff className="size-7 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">{t("noAccess")}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("noAccessHint")}
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/mapa" />}>
          {t("backToMap")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-lede">
            {viewer.profile.staffRole === "admin"
              ? t("introProvince")
              : t("introMunicipality")}
          </p>
        </div>

        {/* The figures live next to the queue they are counted from, so an
            official reading "seis casos sin responder" is one tap from the six. */}
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/informes" />}
          role="link"
        >
          <FileText className="size-4" aria-hidden />
          {t("reports")}
        </Button>
      </header>

      <nav
        aria-label={t("tools")}
        className="sticky top-20 z-20 grid grid-cols-2 gap-3 bg-background/95 py-2 backdrop-blur-sm"
      >
        <Button
          nativeButton={false}
          render={<Link href="/moderacion/identidad" />}
          variant="outline"
          className="h-auto min-h-20 justify-start gap-3 rounded-2xl p-3 text-left whitespace-normal sm:p-4"
        >
          <ShieldCheck className="size-5 text-primary" aria-hidden />
          <span className="flex-1">
            <span className="block">{t("identity")}</span>
            <span className="mt-1 hidden text-xs font-normal text-muted-foreground sm:block">
              {t("identityHint")}
            </span>
          </span>
        </Button>
        <Button
          nativeButton={false}
          render={<Link href="/rutas?ver=pendientes" />}
          role="link"
          variant="outline"
          className="h-auto min-h-20 justify-start gap-3 rounded-2xl p-3 text-left whitespace-normal sm:p-4"
        >
          <Route className="size-5 text-primary" aria-hidden />
          <span className="flex-1">
            <span className="block">{t("routes")}</span>
            <span className="mt-1 hidden text-xs font-normal text-muted-foreground sm:block">
              {t("routesHint")}
            </span>
          </span>
          <ChevronRight
            className="hidden size-4 text-muted-foreground sm:block"
            aria-hidden
          />
        </Button>
        {viewer.profile.staffRole === "admin" && (
          <Button
            nativeButton={false}
            render={<Link href="/moderacion/temas" />}
            role="link"
            variant="outline"
            aria-label={t("categories")}
            className="h-auto min-h-20 justify-start gap-3 rounded-2xl border-primary/20 bg-accent/60 p-3 text-left whitespace-normal sm:p-4"
          >
            <Tags className="size-5 text-primary" aria-hidden />
            <span className="flex-1">
              <span className="block">{t("categoriesShort")}</span>
              <span className="mt-1 hidden text-xs font-normal text-muted-foreground sm:block">
                {t("categoriesHint")}
              </span>
            </span>
            <ChevronRight
              className="hidden size-4 text-muted-foreground sm:block"
              aria-hidden
            />
          </Button>
        )}
      </nav>
      <ModerationQueue />
    </div>
  );
}

export default function ModerationPage() {
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
      <Desk />
    </Suspense>
  );
}
