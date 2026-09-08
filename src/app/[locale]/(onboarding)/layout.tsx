import { ArrowLeft, MapPin, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ViewTransition } from "react";
import { Brand } from "@/components/shell/brand";
import { Link } from "@/i18n/navigation";

export default async function OnboardingLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const t = await getTranslations("onboarding");
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-5">
        <Brand />
        <Link
          href="/mapa"
          className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
      </header>
      <main
        id="contenido"
        className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-5 py-8 lg:grid-cols-2 lg:py-14"
      >
        <aside className="relative hidden min-h-[620px] self-stretch overflow-hidden rounded-[2rem] bg-primary lg:flex">
          <Image
            src="/places/parque-sabaneta.webp"
            alt=""
            fill
            sizes="550px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#102d24]/95 via-[#102d24]/35 to-black/5" />
          <div className="relative mt-auto p-10 text-white">
            <MapPin className="mb-6 size-8" aria-hidden />
            <h2 className="text-balance text-4xl font-medium leading-tight tracking-tight">
              {t("shellTitle")}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
              {t("shellBody")}
            </p>
          </div>
        </aside>
        <div className="mx-auto flex w-full max-w-md flex-col gap-7 lg:py-8">
          <p className="text-xs font-medium tracking-wider text-muted-foreground">
            {t("stepLabel")}
          </p>
          <ViewTransition>{children}</ViewTransition>
          <div className="mt-3 border-t pt-6 text-center">
            <Link
              href="/privacidad"
              className="inline-flex min-h-10 items-center gap-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              {t("privacyNote")}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("optional")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
