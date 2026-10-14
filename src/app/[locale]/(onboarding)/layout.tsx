import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ViewTransition } from "react";
import { Brand } from "@/components/shell/brand";
import { PhotoPanel } from "@/components/shell/photo-panel";
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
        <PhotoPanel
          title={t("shellTitle")}
          body={t("shellBody")}
          priority
          className="hidden min-h-[620px] self-stretch lg:flex"
        />
        <div className="mx-auto flex w-full max-w-md flex-col gap-7 lg:py-8">
          <ViewTransition>{children}</ViewTransition>
        </div>
      </main>
    </div>
  );
}
