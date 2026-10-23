"use client";

import { Button } from "@/components/ui/button";
import { getT } from "@/lib/web/i18n";

/** The last resort: a calm message and a retry, never a stack trace. */
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = getT("landing");
  const common = getT("common");

  return (
    <main
      id="contenido"
      className="container-page flex min-h-dvh max-w-xl flex-col items-start justify-center gap-5 py-20"
    >
      <h1 className="t-h2">{t("errorTitle")}</h1>
      <p className="t-body-lg text-ink-2">{common("errorBody")}</p>
      <Button variant="accent" size="lg" onClick={reset}>
        {common("retry")}
      </Button>
    </main>
  );
}
