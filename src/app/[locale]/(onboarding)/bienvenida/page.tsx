import { Compass, IdCard } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TierCard } from "@/components/onboarding/tier-card";
import { BlurFade } from "@/components/ui/blur-fade";
import { Link } from "@/i18n/navigation";

/**
 * The fork: visitor or resident.
 *
 * Fully static — there is nothing here that depends on who is asking, so it
 * lands in the static shell and appears the instant a link to it is clicked.
 */
export default async function WelcomePage({
  params,
}: PageProps<"/[locale]/bienvenida">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "onboarding" });

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

      <div className="flex flex-col gap-4">
        <BlurFade delay={0.12} inView>
          <TierCard
            href="/verificar"
            icon={<IdCard className="size-6" aria-hidden />}
            title={t("citizen.title")}
            description={t("citizen.description")}
            action={t("citizen.action")}
            highlighted
          />
        </BlurFade>

        <BlurFade delay={0.18} inView>
          <TierCard
            href="/"
            icon={<Compass className="size-6" aria-hidden />}
            title={t("visitor.title")}
            description={t("visitor.description")}
            action={t("visitor.action")}
          />
        </BlurFade>
      </div>

      <BlurFade delay={0.24} inView>
        <p className="text-center text-muted-foreground text-xs">
          <Link className="underline underline-offset-4" href="/entrar">
            {t("alreadyHaveAccount")}
          </Link>
        </p>
      </BlurFade>
    </>
  );
}
