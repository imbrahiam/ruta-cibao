import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
/**
 * The pine close to public pages. On phones the persistent tab bar carries
 * navigation; desktop gets the full information footer.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const tApp = await getTranslations("app");

  const columns = [
    {
      title: t("explore"),
      links: [
        { href: "/mapa", label: tNav("map") },
        { href: "/explorar", label: tNav("explore") },
        { href: "/rutas", label: tNav("routes") },
      ],
    },
    {
      title: t("participate"),
      links: [
        { href: "/consultas", label: tNav("consultations") },
        { href: "/aportes", label: tNav("contributions") },
        { href: "/pasaporte", label: tNav("passport") },
      ],
    },
    {
      title: t("platform"),
      links: [
        { href: "/instalar", label: tNav("install") },
        { href: "/privacidad", label: tNav("privacy") },
        { href: "/api/docs", label: tNav("api"), external: true },
      ],
    },
  ] as const;

  return (
    <footer className="hidden bg-pine text-on-pine md:block">
      <div className="container-page grid grid-cols-[1.4fr_repeat(3,1fr)] gap-8 py-16">
        <div>
          <div className="flex items-center gap-3">
            <LogoMark className="size-10 rounded-[12px] ring-1 ring-white/15" />
            <span className="font-display text-[28px] leading-none tracking-[-0.02em]">
              {tApp("name")}
            </span>
          </div>
          <p className="t-small mt-4 max-w-[34ch] text-on-pine/70">
            {t("about")}
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="t-label text-on-pine/55">{column.title}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  {"external" in link ? (
                    <a
                      href={link.href}
                      className="text-[15px] text-on-pine/70 hover:text-on-pine"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-[15px] text-on-pine/70 hover:text-on-pine"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-page flex items-center justify-between border-t border-white/10 py-6 text-[14px] text-on-pine/55">
        <span>{t("contest")}</span>
        <span>{t("osm")}</span>
      </div>
    </footer>
  );
}
