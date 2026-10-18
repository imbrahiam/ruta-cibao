"use client";

import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { AccountMenu } from "./account-menu";
import { NotificationBell } from "./notification-bell";

const LINKS = [
  { href: "/mapa", key: "map" },
  { href: "/explorar", key: "explore" },
  { href: "/rutas", key: "routes" },
  { href: "/consultas", key: "consultations" },
  { href: "/aportes", key: "contributions" },
] as const;

/**
 * The Genesis nav: a glass pill, logo left in its ink tile, a handful of
 * links, the account on the right. On a phone the links move to the tab bar
 * and this keeps only the logo, the bell and the account.
 */
export function TopNav() {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 px-3 pt-[max(10px,env(safe-area-inset-top))] pb-2 md:px-6 md:pt-4">
      <div className="glass mx-auto flex h-14 max-w-[1200px] items-center gap-2 rounded-full pr-2 pl-3 md:pl-4">
        <Link
          href="/"
          className="press -ml-1 flex items-center rounded-full p-1"
          aria-label={tApp("name")}
        >
          <Logo label={tApp("name")} />
        </Link>
        <nav
          aria-label={t("label")}
          className="ml-4 hidden flex-1 items-center gap-1 md:flex"
        >
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-full px-3 py-1.5 text-[15px] transition-colors",
                  active
                    ? "bg-paper-3 font-medium text-ink"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
