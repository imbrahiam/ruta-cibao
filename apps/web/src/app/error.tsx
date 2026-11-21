"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { Canvas, CanvasTone } from "@/components/canvas-tone";
import { Button, buttonStyles } from "@/components/site/button";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import styles from "@/components/site/site-shell.module.css";
import { getT } from "@/lib/web/i18n";

/*
 * The last resort: a calm message and a retry, never a stack trace. Like the
 * root not-found, it replaces the `(site)` layout, so it brings the public
 * shell itself and mirrors that page's centred column.
 */
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = getT("landing");
  const common = getT("common");

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
            <CircleAlert aria-hidden className="size-6" />
          </span>
          <h1 className="t-h2 font-[family-name:var(--font-fraunces)] text-balance">
            {t("errorTitle")}
          </h1>
          <p className="t-body-lg mt-3 text-pretty text-ink-2">
            {t("errorBody")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button variant="accent" size="lg" onClick={reset}>
              {common("retry")}
            </Button>
            <Link
              href="/"
              className={buttonStyles({ variant: "ghost", size: "lg" })}
            >
              {t("back")}
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
