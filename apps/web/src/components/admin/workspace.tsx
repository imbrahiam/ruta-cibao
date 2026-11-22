"use client";

import type { ApiOutputs } from "@ruta/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Globe, KeyRound, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { LogoMark } from "@/components/brand/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/web/api";
import { InlineError } from "./error-panel";
import { prefetchAdminRoute, QUEUE_POLL_MS } from "./list-queries";
import { ADMIN_GROUPS, ADMIN_SECTIONS, findAdminSection } from "./nav";
import { OfflineBanner } from "./offline-banner";
import { useAdminPageTitle } from "./page-frame";
import { PasskeysDialog } from "./passkeys";
import type { Staff } from "./staff-context";
import { ThemeChoices } from "./theme-menu";
import { useAdminPrefetch } from "./use-admin-prefetch";

type WorkspaceProps = {
  staff: Staff;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
  signOutError: unknown;
  children: ReactNode;
};

/** The sidebar's own state cookie (shadcn's), read once on the client. */
function sidebarStartsOpen() {
  return !document.cookie.split("; ").includes("sidebar_state=false");
}

/**
 * A sidebar row's ink: the open section in full, the rest quieter (glyph and
 * label alike), so the one you are on is found at a glance. Lucide glyphs at
 * 18 px, as in the other consoles; the 3D models stay on the overview's cards.
 */
function navTone(active: boolean) {
  // `!` beats the sub-menu button's own `[&>svg]` colour.
  return active
    ? "text-sidebar-foreground!"
    : "text-muted-foreground! group-hover/menu-item:text-sidebar-foreground! group-hover/menu-sub-item:text-sidebar-foreground!";
}

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
  const [open, setOpen] = useState(sidebarStartsOpen);
  const prefetch = useAdminPrefetch(staff);
  const pageTitle = useAdminPageTitle();
  // The badges keep up with the queues they count.
  const counts = useQuery({
    ...orpc.moderation.counts.queryOptions(),
    refetchInterval: QUEUE_POLL_MS,
  });
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const active = findAdminSection(pathname);
  const nested = active && pathname !== active.href;

  // Once the counts are known, read the sections that have something waiting
  // in the background, so a click lands on rows already in the cache.
  const client = useQueryClient();
  const warmed = useRef(false);
  useEffect(() => {
    const data = counts.data;
    if (!data || warmed.current) return;
    const timer = setTimeout(() => {
      warmed.current = true;
      for (const section of ADMIN_SECTIONS) {
        if (section.countKey && data[section.countKey] > 0) {
          void prefetchAdminRoute(client, section.href, staff);
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [counts.data, client, staff]);

  // The tab says where you are and how much waits there, so it is readable
  // from another tab: "Fotografías (1) | Ruta Cibao", the site's title format.
  const waiting =
    active?.countKey && (!nested || pathname === active.relatedPath)
      ? counts.data?.[active.countKey]
      : undefined;
  const page = nested
    ? pageTitle || t("shell.detail")
    : active
      ? t(active.label)
      : "";
  useEffect(() => {
    if (!page) return;
    document.title = `${page}${waiting ? ` (${waiting})` : ""} | ${t("brand")}`;
  }, [page, waiting, t]);

  // A list remembers its filters: coming back to it from a detail page, or
  // from another section, lands on the same view.
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

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AdminSidebar
        staff={staff}
        scope={scope}
        activeHref={active?.href}
        counts={counts.data}
        countsUnavailable={counts.isError && !counts.data}
        prefetch={prefetch}
        destination={destination}
        onSignOut={onSignOut}
        signingOut={signingOut}
        signOutError={signOutError}
      />
      <SidebarInset className="min-w-0">
        <header
          className={cn(
            // The page's own column, so the trail starts where the title does.
            "mx-auto flex h-14 w-full max-w-[1520px] shrink-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-10",
            // On a desk with the sidebar open and no trail to show, the bar
            // would be an empty band above the title.
            open && !nested && "md:hidden",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <TopbarTrigger />
            {nested ? (
              <Breadcrumb aria-label={t("shell.breadcrumb")}>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link
                        href={destination(active.href)}
                        onMouseEnter={() => prefetch(destination(active.href))}
                      >
                        {t(active.label)}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate">
                      {pathname === active.relatedPath
                        ? t("pending")
                        : pageTitle || t("shell.detail")}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
          </div>
        </header>
        <OfflineBanner />
        <main
          id="contenido"
          className={cn(
            "@container/main mx-auto flex w-full max-w-[1520px] min-w-0 flex-1 flex-col gap-5 px-4 pt-2 pb-10 sm:px-6 lg:px-10",
            open && !nested && "md:pt-7",
          )}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * The topbar's toggle. On a phone it opens the drawer, on a desktop it brings
 * back a collapsed sidebar; its name says which.
 */
function TopbarTrigger() {
  const t = useTranslations("admin");
  const { isMobile, open } = useSidebar();
  return (
    <SidebarTrigger
      className={open ? "md:hidden" : undefined}
      aria-label={t(
        isMobile
          ? "shell.openNavigation"
          : open
            ? "shell.collapseNavigation"
            : "shell.expandNavigation",
      )}
    />
  );
}

function AdminSidebar({
  staff,
  scope,
  activeHref,
  counts,
  countsUnavailable,
  prefetch,
  destination,
  onSignOut,
  signingOut,
  signOutError,
}: {
  staff: Staff;
  scope: string;
  activeHref?: string;
  counts?: ApiOutputs["moderation"]["counts"];
  countsUnavailable: boolean;
  prefetch: (href: string) => void;
  destination: (href: string) => string;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
  signOutError: unknown;
}) {
  const t = useTranslations("admin");
  const { setOpenMobile } = useSidebar();
  const [passkeysOpen, setPasskeysOpen] = useState(false);
  const role = t(
    staff.staffRole === "admin" ? "shell.roleAdmin" : "shell.roleModerator",
  );
  const initials = staff.displayName
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const name = staff.displayName || t("shell.accountMenu");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex min-h-10 items-center justify-between gap-1 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/admin"
            aria-label={t("title")}
            onClick={() => setOpenMobile(false)}
            className="flex min-w-0 items-center gap-2.5 rounded-[10px] p-1.5 outline-hidden ring-sidebar-ring focus-visible:ring-2 group-data-[collapsible=icon]:p-0"
          >
            <LogoMark className="size-7! rounded-lg! group-data-[collapsible=icon]:size-8!" />
            <span className="truncate text-[15px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              {t("title")}
            </span>
          </Link>
          <SidebarTrigger
            aria-label={t("shell.collapseNavigation")}
            className="hidden shrink-0 group-data-[collapsible=icon]:hidden md:inline-flex"
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="scroll-fade-y gap-0 [--fade-surface:var(--sidebar)]">
        <nav aria-label={t("shell.nav")} className="flex flex-col gap-2">
          {ADMIN_GROUPS.map((group) => {
            const sections = ADMIN_SECTIONS.filter(
              (section) =>
                section.group === group.id &&
                (!section.adminOnly || staff.staffRole === "admin"),
            );
            return (
              <SidebarGroup key={group.id}>
                {group.label ? (
                  <SidebarGroupLabel>{t(group.label)}</SidebarGroupLabel>
                ) : null}
                <SidebarGroupContent>
                  {/* Rows sit close within a group; the groups keep their gap. */}
                  <SidebarMenu className="gap-0.5">
                    {(() => {
                      // One row of the menu; `collapsedOnly` is a sub-section
                      // repeated as a plain icon for the collapsed rail, where
                      // the nested list is hidden.
                      const entry = (
                        section: (typeof sections)[number],
                        collapsedOnly = false,
                      ) => {
                        const Icon = section.icon;
                        const count = section.countKey
                          ? counts?.[section.countKey]
                          : undefined;
                        const href = destination(section.href);
                        return (
                          <SidebarMenuItem
                            key={section.href}
                            className={
                              collapsedOnly
                                ? "hidden group-data-[collapsible=icon]:block"
                                : undefined
                            }
                          >
                            <SidebarMenuButton
                              asChild
                              isActive={activeHref === section.href}
                              tooltip={t(section.label)}
                            >
                              <Link
                                href={href}
                                aria-label={
                                  count
                                    ? `${t(section.label)}, ${t("shell.pendingCount", { count })}`
                                    : t(section.label)
                                }
                                aria-current={
                                  activeHref === section.href
                                    ? "page"
                                    : undefined
                                }
                                onPointerEnter={() => prefetch(href)}
                                onFocus={() => prefetch(href)}
                                onTouchStart={() => prefetch(href)}
                                onClick={() => setOpenMobile(false)}
                              >
                                <Icon
                                  aria-hidden="true"
                                  className={navTone(
                                    activeHref === section.href,
                                  )}
                                />
                                <span
                                  className={cn(
                                    "truncate",
                                    navTone(activeHref === section.href),
                                  )}
                                >
                                  {t(section.label)}
                                </span>
                              </Link>
                            </SidebarMenuButton>
                            {count ? (
                              <SidebarMenuBadge
                                aria-hidden="true"
                                // Secondary to the label, and right-aligned on
                                // the last digit so 5 and 14 line up.
                                className="justify-end text-muted-foreground peer-hover/menu-button:text-muted-foreground peer-data-[active=true]/menu-button:text-muted-foreground"
                              >
                                {count}
                              </SidebarMenuBadge>
                            ) : null}
                          </SidebarMenuItem>
                        );
                      };
                      /** A sub-section under its parent: smaller, on the guide line. */
                      const subEntry = (section: (typeof sections)[number]) => {
                        const count = section.countKey
                          ? counts?.[section.countKey]
                          : undefined;
                        const href = destination(section.href);
                        const Icon = section.icon;
                        return (
                          <SidebarMenuSubItem key={section.href}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={activeHref === section.href}
                            >
                              <Link
                                href={href}
                                aria-label={
                                  count
                                    ? `${t(section.label)}, ${t("shell.pendingCount", { count })}`
                                    : t(section.label)
                                }
                                aria-current={
                                  activeHref === section.href
                                    ? "page"
                                    : undefined
                                }
                                onPointerEnter={() => prefetch(href)}
                                onFocus={() => prefetch(href)}
                                onTouchStart={() => prefetch(href)}
                                onClick={() => setOpenMobile(false)}
                              >
                                <Icon
                                  aria-hidden="true"
                                  className={navTone(
                                    activeHref === section.href,
                                  )}
                                />
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 truncate",
                                    navTone(activeHref === section.href),
                                  )}
                                >
                                  {t(section.shortLabel ?? section.label)}
                                </span>
                                {count ? (
                                  <span
                                    aria-hidden="true"
                                    className="shrink-0 text-xs text-muted-foreground tabular-nums"
                                  >
                                    {count}
                                  </span>
                                ) : null}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      };
                      return sections
                        .filter((section) => !section.parent)
                        .map((section) => {
                          const children = sections.filter(
                            (child) => child.parent === section.href,
                          );
                          return (
                            <Fragment key={section.href}>
                              {entry(section)}
                              {children.length > 0 ? (
                                <>
                                  <li className="group-data-[collapsible=icon]:hidden">
                                    <SidebarMenuSub className="mt-0.5 mb-1">
                                      {children.map(subEntry)}
                                    </SidebarMenuSub>
                                  </li>
                                  {children.map((child) => entry(child, true))}
                                </>
                              ) : null}
                            </Fragment>
                          );
                        });
                    })()}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </nav>
        {countsUnavailable ? (
          <p
            role="status"
            className="px-4 text-xs text-muted-foreground group-data-[collapsible=icon]:sr-only"
          >
            {t("shell.countsUnavailable")}
          </p>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  aria-label={t("shell.accountMenu")}
                  className="data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:p-0!"
                >
                  <Avatar className="size-8">
                    {staff.image ? (
                      <AvatarImage src={staff.image} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-sidebar-accent">
                      {initials || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {role}
                    </span>
                  </span>
                  <ChevronsUpDown
                    aria-hidden="true"
                    className="ml-auto size-4 shrink-0 text-muted-foreground"
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                // Anchored to the account button: the same width and edges,
                // and wide enough to read when the sidebar is collapsed.
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 max-w-[calc(100vw-1.5rem)]"
              >
                {/* The button under the menu already says who this is; the
                    menu only adds what it can reach. */}
                {scope ? (
                  <>
                    <DropdownMenuLabel className="font-normal text-pretty text-muted-foreground">
                      {t("scope", { scope })}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <ThemeChoices />
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPasskeysOpen(true)}>
                  <KeyRound aria-hidden="true" />
                  {t("shell.passkeys")}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/">
                    <Globe aria-hidden="true" />
                    {t("shell.backToSite")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={signingOut}
                  onSelect={(event) => {
                    event.preventDefault();
                    void onSignOut();
                  }}
                >
                  <LogOut aria-hidden="true" />
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <InlineError error={signOutError} />
            <PasskeysDialog
              open={passkeysOpen}
              onOpenChange={setPasskeysOpen}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
