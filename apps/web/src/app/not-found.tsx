import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/components/site/button";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { getT } from "@/lib/web/i18n";

export default function NotFound() {
  const t = getT("landing");

  return (
    <>
      <SiteHeader />
      <main
        id="contenido"
        className="container-page flex min-h-[60dvh] max-w-xl flex-col items-start justify-center gap-5 py-20"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-paper-2 text-ink-2">
          <SearchX aria-hidden className="size-6" />
        </span>
        <h1 className="t-h2">{t("notFoundTitle")}</h1>
        <p className="t-body-lg text-ink-2">{t("notFoundBody")}</p>
        <Link
          href="/"
          className={buttonStyles({ variant: "accent", size: "lg" })}
        >
          {t("back")}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
