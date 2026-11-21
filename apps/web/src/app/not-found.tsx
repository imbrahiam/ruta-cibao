import { SearchX } from "lucide-react";
import Link from "next/link";
import { Canvas, CanvasTone } from "@/components/canvas-tone";
import { buttonStyles } from "@/components/site/button";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import styles from "@/components/site/site-shell.module.css";
import { getT } from "@/lib/web/i18n";

/*
 * The root not-found renders outside the `(site)` layout, so it brings the
 * public shell itself: without `styles.site` the header loses its tokens.
 */
export default function NotFound() {
  const t = getT("landing");

  return (
    <div className={styles.site} data-canvas-surface>
      <Canvas />
      <CanvasTone of="site-footer" />
      <SiteHeader />
      <main
        id="contenido"
        className="container-page flex min-h-[50dvh] flex-col items-center justify-center py-16 text-center"
      >
        <div className="flex max-w-md flex-col items-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-paper-2 text-ink-2">
            <SearchX aria-hidden className="size-6" />
          </span>
          <h1 className="t-h2 font-[family-name:var(--font-fraunces)] text-balance">
            {t("notFoundTitle")}
          </h1>
          <p className="t-body-lg mt-3 text-pretty text-ink-2">
            {t("notFoundBody")}
          </p>
          <Link
            href="/"
            className={`${buttonStyles({ variant: "accent", size: "lg" })} mt-8`}
          >
            {t("back")}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
