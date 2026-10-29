import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { getT } from "@/lib/web/i18n";

/**
 * The one page for every link that leads nowhere: missing, malformed,
 * unpublished, removed or expired. It looks identical for all of them, so it
 * says nothing about whether something private once existed there.
 */
export function Unavailable() {
  const t = getT("share");
  const landing = getT("landing");

  return (
    <div className="container-page flex max-w-xl flex-col items-start gap-5 py-20">
      <span className="flex size-12 items-center justify-center rounded-full bg-paper-2 text-ink-2">
        <SearchX aria-hidden className="size-6" />
      </span>
      <h1 className="t-h2">{t("unavailableTitle")}</h1>
      <p className="t-body-lg text-ink-2">{t("unavailableBody")}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className={buttonStyles({ variant: "accent", size: "lg" })}
        >
          {landing("back")}
        </Link>
        <Link
          href="/download"
          className={buttonStyles({ variant: "secondary", size: "lg" })}
        >
          {t("download")}
        </Link>
      </div>
    </div>
  );
}
