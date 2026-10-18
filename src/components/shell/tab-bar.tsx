"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { isActive, NAV_ITEMS } from "./nav-items";

/**
 * The phone's navigation: a floating glass bar within reach of a thumb.
 * Icon and label always together, and the current section is marked by a
 * filled pill and `aria-current`, never by colour alone.
 */
export function TabBar({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className={cx(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(8px,env(safe-area-inset-bottom))] md:hidden",
        className,
      )}
    >
      <ul className="glass pointer-events-auto mx-auto grid h-14 max-w-[420px] grid-cols-5 items-center rounded-full px-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "press flex h-11 w-full max-w-[76px] flex-col items-center justify-center gap-0.5 rounded-full text-[12px] leading-none font-medium tracking-[-0.005em] transition-colors",
                  active ? "bg-ink text-paper" : "text-ink-2 hover:text-ink",
                )}
              >
                <Icon
                  strokeWidth={active ? 1.9 : 1.5}
                  className="size-[19px]"
                  aria-hidden
                />
                <span>{t(item.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
