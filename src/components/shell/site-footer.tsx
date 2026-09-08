import { ArrowUpRight, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Brand } from "./brand";

type FooterLink = { label: string; href: string; document?: boolean };

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("navigation");
  const app = await getTranslations("app");
  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: t("sections.explore"),
      links: [
        { label: nav("map"), href: "/mapa" },
        { label: nav("explore"), href: "/explorar" },
        { label: nav("routes"), href: "/rutas" },
        { label: nav("consultations"), href: "/consultas" },
      ],
    },
    {
      title: t("sections.contribute"),
      links: [
        { label: t("addPlace"), href: "/mapa?agregar=true" },
        { label: nav("contributions"), href: "/aportes" },
        { label: t("verify"), href: "/verificar" },
        { label: nav("install"), href: "/instalar" },
      ],
    },
    {
      title: t("sections.build"),
      links: [
        { label: nav("privacy"), href: "/privacidad" },
        { label: nav("api"), href: "/api/docs", document: true },
        { label: t("spec"), href: "/api/spec.json", document: true },
      ],
    },
  ];

  const linkClass =
    "inline-flex min-h-11 items-center rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4";

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-5 pt-10 pb-6 sm:px-6 md:pt-14 md:pb-8">
        <div className="grid gap-9 md:grid-cols-[1fr_1.7fr] md:gap-12 lg:gap-24">
          <div className="flex flex-col items-start">
            <Brand />
            <p className="mt-4 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              {t("blurb")}
            </p>
            <Button
              variant="outline"
              className="mt-5 h-11 rounded-full px-4"
              nativeButton={false}
              render={<Link href="/mapa" />}
            >
              {t("openMap")}
              <ArrowUpRight className="size-4" aria-hidden />
            </Button>
          </div>
          <nav
            aria-label={t("label")}
            className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3"
          >
            {columns.map((column, index) => (
              <div
                key={column.title}
                className={
                  index === 2
                    ? "col-span-2 border-t pt-5 sm:col-span-1 sm:border-0 sm:pt-0"
                    : ""
                }
              >
                <h2 className="mb-2 text-xs font-semibold tracking-wide text-foreground">
                  {column.title}
                </h2>
                <ul
                  className={
                    index === 2 ? "grid grid-cols-2 gap-x-6 sm:block" : ""
                  }
                >
                  {column.links.map((link) => (
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
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-between md:mt-10">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {t("region")}
          </p>
          <div className="flex flex-wrap items-center gap-x-5">
            <a
              href="https://www.openstreetmap.org/copyright"
              className="inline-flex min-h-11 items-center gap-1 rounded-md text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4"
              rel="noreferrer"
              target="_blank"
            >
              {t("osm")}
              <ArrowUpRight className="size-3" aria-hidden />
            </a>
            <a
              href="https://www.geoboundaries.org"
              className="inline-flex min-h-11 items-center gap-1 rounded-md text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4"
              rel="noreferrer"
              target="_blank"
            >
              {t("boundaries")}
              <ArrowUpRight className="size-3" aria-hidden />
            </a>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-pretty text-[11px] leading-relaxed text-muted-foreground">
          {t("credits", { app: app("name") })}
        </p>
      </div>
    </footer>
  );
}
