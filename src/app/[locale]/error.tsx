"use client";

import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Something failed while drawing a page. Says so plainly, offers the retry
 * that usually fixes a dropped connection, and the way back to the map.
 */
export default function PageError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("recovery");
  return (
    <main
      id="contenido"
      className="flex min-h-[70dvh] flex-1 flex-col items-center justify-center bg-paper px-6 py-16 text-center"
    >
      <div role="alert" className="flex max-w-md flex-col items-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-paper-3 text-ink-2">
          <RotateCw strokeWidth={1.5} className="size-6" />
        </span>
        <h1 className="t-h2 mt-6">{t("title")}</h1>
        <p className="t-body-lg mt-3 text-ink-2">{t("body")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="primary" onClick={retry}>
            {t("retry")}
          </Button>
          <ButtonLink href="/mapa" variant="secondary">
            {t("openMap")}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
