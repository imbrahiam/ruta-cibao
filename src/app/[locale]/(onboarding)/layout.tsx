import { ArrowLeft, MapPin } from "lucide-react";
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
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 md:h-20">
        <Brand />
        <Link
          href="/mapa"
          className="flex min-h-11 items-center gap-2 rounded-full px-3 text-muted-foreground text-sm transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
      </header>
      <main
        id="contenido"
        className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-14 px-5 pt-6 pb-10 lg:items-center sm:py-8 lg:grid-cols-2 lg:py-14"
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
          <ViewTransition>{children}</ViewTransition>
        </div>
      </main>
    </div>
  );
}
