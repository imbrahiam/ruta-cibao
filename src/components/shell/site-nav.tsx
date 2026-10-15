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
 * Where the header goes on a wide screen: the phone's tabs in the phone's
 * order, with "Inicio" in front — the landing a visitor on a laptop wants to
 * get back to. "Mi cuenta" is the account area at the right edge (the
 * sign-in button, or the avatar), not a second item for the same place.
 */
const desktopDestinations = [
  { href: "/", key: "home", icon: House },
  { href: "/mapa", key: "map", icon: MapIcon },
  { href: "/explorar", key: "explore", icon: Compass },
  { href: "/aportes", key: "contributions", icon: ClipboardList },
  { href: "/consultas", key: "consultations", icon: MessagesSquare },
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
        className="fixed inset-x-0 bottom-0 z-40 grid h-(--mobile-nav-height) grid-cols-5 content-start border-border border-t bg-background px-0.5 pt-1.5 pb-[max(.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {destinations.map(({ href, key, icon: Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "group flex min-h-12 flex-col items-center justify-start gap-1 rounded-xl pt-0.5 text-[13px] leading-4 tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2",
                current
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground active:text-foreground",
              )}
            >
              {/* The selection is a soft grey pill behind the icon and a dot
                  under the word: a shape and a mark, so it reads in sunlight
                  and without colour. The pill grows in under motion-safe only. */}
              <span className="relative flex h-8 w-14 items-center justify-center">
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-0 rounded-full",
                    current
                      ? "nav-pill bg-foreground/[0.08]"
                      : "group-active:bg-foreground/[0.05]",
                  )}
                />
                <Icon
                  className="relative size-[22px]"
                  strokeWidth={current ? 2.25 : 1.75}
                  aria-hidden
                />
              </span>
              <span className="max-w-full whitespace-nowrap">{t(key)}</span>
              <span
                aria-hidden
                className={cn(
                  "size-1 rounded-full",
                  current ? "bg-foreground" : "bg-transparent",
                )}
              />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label={t("label")} className="hidden items-center gap-1 md:flex">
      {destinations.map(({ href, key }) => {
        const current = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "relative flex h-10 items-center justify-center rounded-full px-3.5 font-medium text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 lg:px-4",
              current
                ? "bg-foreground/[0.07] text-foreground"
                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
            )}
          >
            {t(key)}
            {current && (
              <span
                aria-hidden
                className="absolute -bottom-2 left-1/2 size-1 -translate-x-1/2 rounded-full bg-foreground"
              />
            )}
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
            className="fixed inset-x-0 bottom-0 z-40 h-(--mobile-nav-height) border-t bg-background md:hidden"
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
