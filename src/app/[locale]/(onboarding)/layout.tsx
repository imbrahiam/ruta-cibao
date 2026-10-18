import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

/**
 * Sign-in, the resident-or-visitor fork and cédula verification share one
 * quiet frame: the task on the left, and on a wide screen the province itself
 * on the right, in a photo frame, so the step reads as part of a place rather
 * than a form floating in nothing.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getTranslations("onboarding.shell");
  const tApp = await getTranslations("app");

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto grid min-h-dvh max-w-[1200px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:px-6">
        <div className="flex flex-col px-4 pt-[max(16px,env(safe-area-inset-top))] pb-10 sm:px-6 lg:px-0">
          <header className="flex h-14 items-center justify-between">
            <Link
              href="/"
              className="press -ml-1 rounded-full p-1"
              aria-label={tApp("name")}
            >
              <Logo label={tApp("name")} />
            </Link>
            <Link
              href="/mapa"
              className="press inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] text-ink-2 hover:bg-paper-3 hover:text-ink"
            >
              <ArrowLeft strokeWidth={1.5} className="size-4" />
              {t("back")}
            </Link>
          </header>
          <main
            id="contenido"
            className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10"
          >
            {children}
          </main>
        </div>
        <aside className="hidden py-6 lg:block">
          <figure className="sticky top-6 h-[calc(100dvh-48px)] rounded-frame bg-paper-2 p-3">
            <div className="relative h-full overflow-hidden rounded-[24px]">
              <Image
                src="/places/presa-moncion.webp"
                alt={t("photoAlt")}
                fill
                sizes="(min-width: 1200px) 560px, 50vw"
                className="object-cover"
                priority
              />
              <figcaption className="absolute inset-x-4 bottom-4 rounded-card bg-[#121211]/55 p-4 text-[#f3f2ee] backdrop-blur-md">
                <p className="t-label opacity-70">{t("photoEyebrow")}</p>
                <p className="mt-1 text-[17px] leading-snug font-medium tracking-[-0.012em]">
                  {t("photoCaption")}
                </p>
              </figcaption>
            </div>
          </figure>
        </aside>
      </div>
    </div>
  );
}
