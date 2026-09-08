import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResidencyChoice } from "@/components/onboarding/residency-choice";
import { BlurFade } from "@/components/ui/blur-fade";
import { Link } from "@/i18n/navigation";
import { safeCallbackPath } from "@/modules/access/route-policy";
import { requirePageMember } from "@/modules/access/server";

/**
 * The fork: resident or visitor.
 *
 * Shown once, immediately after an account exists, because that is the only
 * moment where asking costs nothing. `next` carries where the person was
 * heading before sign-in got in the way, so choosing "just visiting" puts them
 * back on the map rather than on a landing page they did not ask for.
 */
async function Fork({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeCallbackPath((await searchParams).next, "/mapa");
  const viewer = await requirePageMember(
    `/bienvenida?next=${encodeURIComponent(next)}`,
  );
  if (viewer.kind === "citizen" || viewer.profile.residencyDeclaredAt)
    redirect(next === "/bienvenida" ? "/mapa" : next);

  return <ResidencyChoice next={next} />;
}

export default async function WelcomePage({
  searchParams,
}: PageProps<"/[locale]/bienvenida">) {
  const t = await getTranslations("onboarding");

  return (
    <>
      <BlurFade delay={0.05} inView>
        <header className="flex flex-col gap-2 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("chooseTier")}</p>
        </header>
      </BlurFade>

      {/* Reading `next` is a runtime access; isolating it keeps the heading and
          the frame in the static shell. */}
      <Suspense fallback={<div className="min-h-52" aria-hidden />}>
        <Fork searchParams={searchParams} />
      </Suspense>

      <Link
        href="/mapa"
        className="text-center text-sm text-muted-foreground underline underline-offset-4"
      >
        {t("back")}
      </Link>
    </>
  );
}
