import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getT } from "@/lib/web/i18n";
import { site } from "@/lib/web/site";

const LINK =
  "inline-flex min-h-11 items-center rounded-full px-1 text-[15px] text-on-pine/80 underline-offset-4 hover:text-on-pine hover:underline";

export function SiteFooter() {
  const t = getT("landing");

  return (
    <footer className="bg-pine text-on-pine">
      <div className="container-page flex flex-col gap-10 py-12 md:flex-row md:justify-between">
        <div className="flex max-w-sm flex-col gap-4">
          <Logo
            label={t("brand")}
            className="[&_span:last-child]:text-on-pine"
          />
          <p className="t-small text-on-pine/75">{t("province")}</p>
          <p className="t-small text-on-pine/75">{t("notice")}</p>
        </div>
        <nav aria-label={t("footerLabel")}>
          <ul className="flex flex-col gap-0.5">
            <li>
              <Link href="/privacidad" className={LINK}>
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link href="/terminos" className={LINK}>
                {t("terms")}
              </Link>
            </li>
            <li>
              <Link href="/soporte" className={LINK}>
                {t("support")}
              </Link>
            </li>
            <li>
              <Link href="/cuenta/eliminar" className={LINK}>
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
