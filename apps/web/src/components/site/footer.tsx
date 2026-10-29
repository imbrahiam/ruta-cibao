import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getT } from "@/lib/web/i18n";
import { site } from "@/lib/web/site";

const LINK =
  "inline-flex min-h-11 items-center rounded-full px-1 text-[15px] text-ink-2 underline-offset-4 hover:text-ink hover:underline";

export function SiteFooter() {
  const t = getT("landing");

  return (
    <footer className="border-t border-line bg-paper-2 text-ink">
      <div className="container-page flex flex-col gap-10 py-12 md:flex-row md:justify-between">
        <div className="flex max-w-sm flex-col gap-4">
          <Logo label={t("brand")} />
          <p className="t-small text-ink-2">{t("province")}</p>
          <p className="t-small text-ink-2">{t("notice")}</p>
        </div>
        <nav aria-label={t("footerLabel")}>
          <ul className="flex flex-col gap-0.5">
            <li>
              <Link href="/privacy" className={LINK}>
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terms" className={LINK}>
                {t("terms")}
              </Link>
            </li>
            <li>
              <Link href="/support" className={LINK}>
                {t("support")}
              </Link>
            </li>
            <li>
              <Link href="/account/delete" className={LINK}>
                {t("deletion")}
              </Link>
            </li>
            {site.sourceUrl ? (
              <li>
                <a href={site.sourceUrl} rel="noopener" className={LINK}>
                  {t("source")}
                </a>
              </li>
            ) : null}
            <li>
              <Link href="/admin" className={LINK}>
                {t("staff")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
