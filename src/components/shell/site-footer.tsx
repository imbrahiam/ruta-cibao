import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

/**
 * An ink band, the one place the white mark sits on its own ground. Hidden on
 * a phone, where the tab bar already carries the navigation.
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
    <footer className="hidden bg-[#121211] text-[#f3f2ee] md:block dark:shadow-ring">
      <div className="container-page grid grid-cols-[1.4fr_repeat(3,1fr)] gap-8 py-16">
        <div>
          <div className="flex items-center gap-3">
            <LogoMark className="size-10 rounded-[12px] ring-1 ring-white/15" />
            <span className="text-[17px] font-medium tracking-[-0.012em]">
              {tApp("name")}
            </span>
          </div>
          <p className="t-small mt-4 max-w-[34ch] text-[#b4b1a8]">
            {t("about")}
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="t-label text-[#85827a]">{column.title}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  {"external" in link ? (
                    <a
                      href={link.href}
                      className="text-[15px] text-[#b4b1a8] hover:text-[#f3f2ee]"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-[15px] text-[#b4b1a8] hover:text-[#f3f2ee]"
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
      <div className="container-page flex items-center justify-between border-t border-white/10 py-6 text-[14px] text-[#85827a]">
        <span>{t("contest")}</span>
        <span>{t("osm")}</span>
      </div>
    </footer>
  );
}
