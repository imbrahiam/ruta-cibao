"use client";

import { MapPinOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

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
      // `flex-1` fills the shell between header and bottom nav, so the content
      // centres in the space the person actually sees; `min-h` keeps it
      // centred where there is no flex parent growing it (map shell, root).
      className="flex min-h-[70dvh] flex-1 flex-col items-center justify-center p-5"
    >
      {/* No card: an error state is the page, not a thing on the page — the
          content sits centred on the background, the way the 404 does. */}
      <div role="alert" className="max-w-md text-center">
        <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
          <MapPinOff className="size-6" aria-hidden />
        </span>
        <h1 className="text-balance font-semibold text-2xl tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 mb-7 text-pretty text-muted-foreground text-sm leading-relaxed">
          {t("body")}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button className="h-11 rounded-full px-6" onClick={retry}>
            {t("retry")}
          </Button>
          <Button
            className="h-11 rounded-full px-6"
            variant="outline"
            nativeButton={false}
            render={<Link href="/" />}
          >
            {t("home")}
          </Button>
        </div>
      </div>
    </main>
  );
}
