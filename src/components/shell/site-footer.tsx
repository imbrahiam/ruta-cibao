import { ArrowUpRight, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ConnectionStatus } from "@/components/landing/connection-status";
import { Link } from "@/i18n/navigation";

type FooterLink = { label: string; href: string; document?: boolean };

/**
 * The deep-green slab that closes a page.
 *
 * Short links in large type rather than columns of small ones — the people
 * reading this footer are as likely to be on a cheap phone in the sun as at a
 * desk. Then a line that says whether the data is live, and who made it.
 */
export async function SiteFooter() {
  const [t, nav, app] = await Promise.all([
    getTranslations("footer"),
    getTranslations("navigation"),
    getTranslations("app"),
  ]);

  const links: FooterLink[] = [
    { label: nav("map"), href: "/mapa" },
    { label: nav("explore"), href: "/explorar" },
    { label: nav("routes"), href: "/rutas" },
    { label: nav("consultations"), href: "/consultas" },
    { label: t("reports"), href: "/informes" },
    { label: nav("install"), href: "/instalar" },
    { label: nav("privacy"), href: "/privacidad" },
    { label: nav("api"), href: "/api/docs", document: true },
  ];

  const linkClass =
    "inline-flex min-h-12 items-center rounded-md font-medium text-white text-xl tracking-[-0.01em] underline-offset-[6px] hover:underline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4 md:text-2xl";
  const smallLink =
    "inline-flex min-h-11 items-center gap-1 rounded-md text-base text-white/80 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4";

  return (
    <footer className="mt-auto rounded-t-[2rem] bg-[#1a4236] text-white md:rounded-t-[2.5rem]">
      <div className="mx-auto max-w-6xl px-5 pt-12 pb-10 md:pt-20 md:pb-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-16">
          <div className="flex flex-col items-start gap-6">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-[#1a4236] md:size-14">
                <MapPin className="size-6 md:size-7" aria-hidden />
              </span>
              <span className="font-bold text-[2.5rem] leading-none tracking-[-0.04em] md:text-6xl">
                {app("name")}
              </span>
            </Link>
            <ConnectionStatus />
          </div>

          <nav aria-label={t("label")} className="md:max-w-md">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
              {links.map((link) => (
                <li key={link.href}>
                  {link.document ? (
                    <a href={link.href} className={linkClass}>
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-white/15 border-t pt-6 md:mt-16 md:flex-row md:items-start md:justify-between md:gap-10">
          <div className="max-w-xl">
            <p className="font-semibold text-base">{t("contest")}</p>
            <p className="mt-1 text-base text-white/80">{t("region")}</p>
          </div>
          <div className="max-w-md">
            <p className="text-base text-white/80 leading-relaxed">
              {t("dataCredits")}
            </p>
            <div className="flex flex-wrap gap-x-5">
              <a
                href="https://www.openstreetmap.org/copyright"
                className={smallLink}
                rel="noreferrer"
                target="_blank"
              >
                {t("osm")}
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
              <a
                href="https://www.geoboundaries.org"
                className={smallLink}
                rel="noreferrer"
                target="_blank"
              >
                {t("boundaries")}
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
              <a href="/api/spec.json" className={smallLink}>
                {t("spec")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
