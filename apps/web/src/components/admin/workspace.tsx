"use client";

import type { ApiOutputs } from "@ruta/contracts";
import { useIsFetching, useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronsUpDown,
  Globe,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Button, IconButton } from "@/components/ui/button";
import { orpc } from "@/lib/web/api";
import { cx } from "@/lib/web/cx";
import { InlineError } from "./error-panel";
import { ADMIN_GROUPS, ADMIN_SECTIONS, findAdminSection } from "./nav";
import { useAdminPageTitle } from "./page-frame";
import type { Staff } from "./staff-context";
import { useAdminPrefetch } from "./use-admin-prefetch";
import styles from "./workspace.module.css";

type WorkspaceProps = {
  staff: Staff;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
  signOutError: unknown;
  children: ReactNode;
};

export function AdminWorkspace({
  staff,
  onSignOut,
  signingOut,
  signOutError,
  children,
}: WorkspaceProps) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [savedSearches, setSavedSearches] = useState<Record<string, string>>(
    {},
  );
  const prefetch = useAdminPrefetch(staff);
  const pageTitle = useAdminPageTitle();
  const counts = useQuery(orpc.moderation.counts.queryOptions());
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const fetching = useIsFetching() > 0;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const desktopToggle = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(pathname);
  const active = findAdminSection(pathname);
  const nested = active && pathname !== active.href;

  useEffect(() => {
    if (ADMIN_SECTIONS.some((section) => section.href === pathname)) {
      setSavedSearches((current) =>
        current[pathname] === search
          ? current
          : { ...current, [pathname]: search },
      );
    }
  }, [pathname, search]);

  const destination = (href: string) =>
    savedSearches[href] ? `${href}?${savedSearches[href]}` : href;
  const scope =
    staff.staffScope === "all"
      ? t("province")
      : staff.staffScope
          .map(
            (id) => municipalities.data?.find((item) => item.id === id)?.name,
          )
          .filter(Boolean)
          .join(", ");

  useEffect(() => {
    setCollapsed(
      document.cookie.split("; ").includes("ruta-admin-sidebar=collapsed"),
    );
  }, []);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      setMobileOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const dialog = drawer.current;
    if (!dialog) return;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(width > 1000px)");
    const closeOnDesktop = () => {
      if (desktop.matches) {
        dialog.close();
        setMobileOpen(false);
        desktopToggle.current?.focus();
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    // biome-ignore lint/suspicious/noDocumentCookie: persist the UI preference in browsers without Cookie Store.
    document.cookie = `ruta-admin-sidebar=${next ? "collapsed" : "expanded"}; Path=/admin; Max-Age=604800; SameSite=Lax`;
  };

  const sidebar = (compact: boolean, mobile = false) => (
    <Sidebar
      staff={staff}
      compact={compact}
      mobile={mobile}
      scope={scope || t("loading")}
      activeHref={active?.href}
      counts={counts.isError ? undefined : counts.data}
      countsUnavailable={counts.isError}
      prefetch={prefetch}
      destination={destination}
      onNavigate={() => setMobileOpen(false)}
      onToggle={mobile ? () => setMobileOpen(false) : toggleCollapsed}
      onSignOut={onSignOut}
      signingOut={signingOut}
      signOutError={signOutError}
    />
  );

  return (
    <div className={styles.shell} data-collapsed={collapsed}>
      <aside className={styles.desktopSidebar}>{sidebar(collapsed)}</aside>
      <dialog
        ref={drawer}
        className={styles.mobileDrawer}
        aria-label={t("shell.nav")}
        onClose={() => setMobileOpen(false)}
        onCancel={() => setMobileOpen(false)}
        onPointerDown={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            setMobileOpen(false);
        }}
      >
        {sidebar(false, true)}
      </dialog>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarStart}>
            <span className={styles.mobileTrigger}>
              <IconButton
                label={t("shell.openNavigation")}
                variant="ghost"
                onClick={() => setMobileOpen(true)}
                aria-expanded={mobileOpen}
              >
                <Menu />
              </IconButton>
            </span>
            <span className={styles.desktopTrigger}>
              <IconButton
                ref={desktopToggle}
                label={t(
                  collapsed
                    ? "shell.expandNavigation"
                    : "shell.collapseNavigation",
                )}
                variant="ghost"
                aria-expanded={!collapsed}
                onClick={toggleCollapsed}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </IconButton>
            </span>
            <nav
              aria-label={t("shell.breadcrumb")}
              className={styles.breadcrumb}
            >
              <ol>
                <li>
                  {pathname === "/admin" ? (
                    <span aria-current="page">{t("shell.overview")}</span>
                  ) : (
                    <Link href="/admin">{t("shell.overview")}</Link>
                  )}
                </li>
                {active && active.href !== "/admin" ? (
                  <>
                    <li aria-hidden="true">
                      <ChevronRight size={14} />
                    </li>
                    <li>
                      {nested ? (
                        <Link
                          href={destination(active.href)}
                          onMouseEnter={() =>
                            prefetch(destination(active.href))
                          }
                        >
                          {t(active.label)}
                        </Link>
                      ) : (
                        <span aria-current="page">{t(active.label)}</span>
                      )}
                    </li>
                  </>
                ) : null}
                {nested ? (
                  <>
                    <li aria-hidden="true">
                      <ChevronRight size={14} />
                    </li>
                    <li className={styles.detailCrumb}>
                      <span aria-current="page">
                        {pathname === active.relatedPath
                          ? t("pending")
                          : pageTitle || t("shell.detail")}
                      </span>
                    </li>
                  </>
                ) : null}
              </ol>
            </nav>
          </div>
          <div className={styles.topbarEnd}>
            <span className={styles.scope}>{scope || t("loading")}</span>
            <span className={styles.fetchState} role="status">
              {fetching ? (
                <>
                  <LoaderCircle
                    size={14}
                    aria-hidden="true"
                    className={styles.spinner}
                  />
                  <span>{t("shell.updating")}</span>
                </>
              ) : (
                <span>{t("shell.upToDate")}</span>
              )}
            </span>
          </div>
        </header>
        <main id="contenido" className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  staff,
  compact,
  mobile,
  scope,
  activeHref,
  counts,
  countsUnavailable,
  prefetch,
  destination,
  onNavigate,
  onToggle,
  onSignOut,
  signingOut,
  signOutError,
}: {
  staff: Staff;
  compact: boolean;
  mobile: boolean;
  scope: string;
  activeHref?: string;
  counts?: ApiOutputs["moderation"]["counts"];
  countsUnavailable: boolean;
  prefetch: (href: string) => void;
  destination: (href: string) => string;
  onNavigate: () => void;
  onToggle: () => void;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
  signOutError: unknown;
}) {
  const t = useTranslations("admin");
  const role = t(
    staff.staffRole === "admin" ? "shell.roleAdmin" : "shell.roleModerator",
  );
  const initials = staff.displayName
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return (
    <div className={styles.sidebarInner} data-compact={compact}>
      <div className={styles.sidebarHeader}>
        <Link
          href="/admin"
          aria-label={t("title")}
          className={styles.brand}
          onNavigate={onNavigate}
        >
          {compact ? <LogoMark /> : <Logo label={t("title")} />}
        </Link>
        {mobile ? (
          <IconButton
            label={t("shell.closeNavigation")}
            variant="ghost"
            size="sm"
            onClick={onToggle}
          >
            <X />
          </IconButton>
        ) : null}
      </div>
      <nav aria-label={t("shell.nav")} className={styles.navigation}>
        {ADMIN_GROUPS.map((group) => (
          <section className={styles.navGroup} key={group.id}>
            <h2 className={styles.groupTitle}>{t(group.label)}</h2>
            <ul>
              {ADMIN_SECTIONS.filter(
                (section) =>
                  section.group === group.id &&
                  (!section.adminOnly || staff.staffRole === "admin"),
              ).map((section) => {
                const Icon = section.icon;
                const count = section.countKey
                  ? counts?.[section.countKey]
                  : undefined;
                return (
                  <li key={section.href}>
                    <Link
                      href={destination(section.href)}
                      aria-label={
                        count
                          ? `${t(section.label)}, ${t("shell.pendingCount", { count })}`
                          : t(section.label)
                      }
                      aria-current={
                        activeHref === section.href ? "page" : undefined
                      }
                      className={cx(
                        styles.navLink,
                        activeHref === section.href && styles.activeLink,
                      )}
                      title={compact ? t(section.label) : undefined}
                      onPointerEnter={() => prefetch(destination(section.href))}
                      onFocus={() => prefetch(destination(section.href))}
                      onTouchStart={() => prefetch(destination(section.href))}
                      onNavigate={onNavigate}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span className={styles.navLabel}>
                        {t(section.label)}
                      </span>
                      {count ? (
                        <span className={styles.badge} aria-hidden="true">
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {countsUnavailable ? (
          <p
            className={compact ? "sr-only" : styles.countsNotice}
            role="status"
          >
            {t("shell.countsUnavailable")}
          </p>
        ) : null}
      </nav>
      <div className={styles.sidebarFooter}>
        <details
          className={styles.userMenu}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              event.currentTarget.open = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && event.currentTarget.open) {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            className={styles.userTrigger}
            aria-label={t("shell.accountMenu")}
          >
            <span className={styles.avatar} aria-hidden="true">
              {initials || <UserRound size={18} />}
            </span>
            <span className={styles.userText}>
              <strong>{staff.displayName || t("shell.accountMenu")}</strong>
              <small>{role}</small>
            </span>
            <ChevronsUpDown
              size={15}
              aria-hidden="true"
              className={styles.userChevron}
            />
          </summary>
          <div className={styles.userPopup}>
            <p className={styles.popupScope}>{t("scope", { scope })}</p>
            <Link href="/" onNavigate={onNavigate}>
              <Globe size={16} aria-hidden="true" />
              {t("shell.backToSite")}
            </Link>
            <Button
              variant="ghost"
              block
              onClick={onSignOut}
              disabled={signingOut}
            >
              <LogOut aria-hidden="true" />
              {t(signingOut ? "loading" : "signOut")}
            </Button>
            <InlineError error={signOutError} />
          </div>
        </details>
      </div>
    </div>
  );
}
