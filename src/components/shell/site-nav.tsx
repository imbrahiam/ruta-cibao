"use client";

import {
  ClipboardList,
  Compass,
  House,
  Map as MapIcon,
  MessagesSquare,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Where the header goes on a wide screen. "Inicio" is the public landing page,
 * which a visitor on a laptop reasonably wants to get back to.
 */
const desktopDestinations = [
  { href: "/", key: "home", icon: House },
  { href: "/explorar", key: "explore", icon: Compass },
  { href: "/mapa", key: "map", icon: MapIcon },
  { href: "/consultas", key: "consultations", icon: MessagesSquare },
  { href: "/cuenta", key: "account", icon: UserRound },
] as const;

/**
 * The phone's tab bar, which is the installed app's whole navigation.
 *
 * No "Inicio": the app opens on the map (`start_url`), and a tab spent on the
 * marketing page is one a returning resident never uses. Its place goes to
 * "Mis aportes" — what you reported and where it stands, the "my requests"
 * tab every civic reporting app has, and the reason to come back.
 */
const mobileDestinations = [
  { href: "/mapa", key: "map", icon: MapIcon },
  { href: "/explorar", key: "explore", icon: Compass },
  { href: "/aportes", key: "contributions", icon: ClipboardList },
  { href: "/consultas", key: "consultations", icon: MessagesSquare },
  { href: "/cuenta", key: "account", icon: UserRound },
] as const;

/** A section is current on its own page and on everything under it. */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The bar, once the current path is known.
 *
 * Split from the export below because `usePathname` is a runtime read: on a
 * route like `/consultas/[slug]` the path is not knowable until the request, so
 * without a boundary this one highlight would drag every page it appears on out
 * of the prerender.
 */
function Destinations({ mobile }: { mobile: boolean }) {
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const destinations = mobile ? mobileDestinations : desktopDestinations;

  if (mobile) {
    return (
      <nav
        aria-label={t("label")}
        className="fixed inset-x-0 bottom-0 z-40 grid h-(--mobile-nav-height) grid-cols-5 content-start border-black/5 border-t bg-background/90 px-1 pt-1.5 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-1px_12px_-6px_rgb(0_0_0/0.12)] backdrop-blur-xl md:hidden"
      >
        {destinations.map(({ href, key, icon: Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "group flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                current
                  ? "font-semibold text-primary"
                  : "font-medium text-muted-foreground active:text-foreground",
              )}
            >
              {/* The pill behind the icon is the selection, Material-style:
                  a filled shape reads at a glance in sunlight, where a colour
                  change on a thin icon does not. */}
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  current ? "bg-accent" : "group-active:bg-secondary",
                )}
              >
                <Icon
                  className="size-5"
                  strokeWidth={current ? 2.25 : 1.75}
                  aria-hidden
                />
              </span>
              <span className="max-w-full truncate px-0.5">{t(key)}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={t("label")} className="hidden items-center gap-1 md:flex">
      {destinations.map(({ href, key, icon: Icon }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-full px-3 font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 lg:px-4",
              current
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteNav({ mobile = false }: { mobile?: boolean }) {
  return (
    // The fallback holds the bar's exact height so nothing under the thumb
    // moves when the real one arrives a frame later.
    <Suspense
      fallback={
        mobile ? (
          <div
            aria-hidden
            className="fixed inset-x-0 bottom-0 z-40 h-(--mobile-nav-height) border-t bg-background/95 backdrop-blur-md md:hidden"
          />
        ) : (
          <div aria-hidden className="hidden h-11 md:block" />
        )
      }
    >
      <Destinations mobile={mobile} />
    </Suspense>
  );
}
