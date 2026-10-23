import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button";
import { getT } from "@/lib/web/i18n";
import { site } from "@/lib/web/site";

/** The public site header: the mark, and the two things a visitor may need. */
export function SiteHeader() {
  const t = getT("landing");

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <Link href="/" aria-label={t("brand")} className="rounded-full">
          <Logo label={t("brand")} />
        </Link>
        <nav aria-label={t("navLabel")} className="flex items-center gap-1">
          {site.sourceUrl ? (
            <a
              href={site.sourceUrl}
              rel="noopener"
              className={`${buttonStyles({ variant: "ghost", size: "sm" })} hidden sm:inline-flex`}
            >
              {t("source")}
            </a>
          ) : null}
          <Link
            href="/admin"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            {t("staff")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
