import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignInForm } from "@/components/onboarding/sign-in-form";
import { BlurFade } from "@/components/ui/blur-fade";

/** Static: nothing on this page depends on who is asking. */
export default async function SignInPage({
  params,
}: PageProps<"/[locale]/entrar">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <>
      <BlurFade delay={0.05} inView>
        <header className="flex flex-col gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">
            {t("signIn")}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("intro")}
          </p>
        </header>
      </BlurFade>

      <BlurFade delay={0.1} inView>
        <SignInForm />
      </BlurFade>
    </>
  );
}
