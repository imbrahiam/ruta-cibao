"use client";

import {
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

const destinations = [
  { href: "/", key: "home", icon: House },
  { href: "/explorar", key: "explore", icon: Compass },
  { href: "/mapa", key: "map", icon: MapIcon },
  { href: "/consultas", key: "consultations", icon: MessagesSquare },
  { href: "/cuenta", key: "account", icon: UserRound },
] as const;

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
  return (
    <nav
      aria-label={t("label")}
      className={cn(
        mobile
          ? "fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
          : "hidden items-center gap-1 md:flex",
      )}
    >
      {destinations.map(({ href, key, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center justify-center rounded-xl font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2",
            mobile
              ? "flex-col gap-1 py-1 text-[11px]"
              : "gap-1 px-2 text-sm lg:gap-2 lg:px-4",
            pathname === href && "bg-accent text-primary",
          )}
        >
          <Icon className="size-4.5" aria-hidden />
          {t(key)}
        </Link>
      ))}
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
            className="fixed inset-x-0 bottom-0 z-40 h-[calc(3.25rem+max(0.5rem,env(safe-area-inset-bottom)))] border-t bg-background/95 backdrop-blur-md md:hidden"
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
