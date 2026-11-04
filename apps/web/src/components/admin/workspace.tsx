"use client";

import type { ApiOutputs } from "@ruta/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Globe, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { orpc } from "@/lib/web/api";
import { InlineError } from "./error-panel";
import { prefetchAdminRoute } from "./list-queries";
import { ADMIN_GROUPS, ADMIN_SECTIONS, findAdminSection } from "./nav";
import { OfflineBanner } from "./offline-banner";
import { useAdminPageTitle } from "./page-frame";
import type { Staff } from "./staff-context";
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
  const counts = useQuery(orpc.moderation.counts.queryOptions());
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
  // from another tab: "Fotografías (1) · Mesa municipal".
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
    document.title = `${page}${waiting ? ` (${waiting})` : ""} · ${t("title")}`;
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
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger
              className={open ? "md:hidden" : undefined}
              aria-label={t(
                open ? "shell.collapseNavigation" : "shell.expandNavigation",
              )}
            />
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
          className="mx-auto flex w-full max-w-[1520px] min-w-0 flex-1 flex-col gap-6 px-4 pt-2 pb-10 sm:px-6 lg:px-10"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
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
      <SidebarContent>
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
                  <SidebarMenu>
                    {sections.map((section) => {
                      const Icon = section.icon;
                      const count = section.countKey
                        ? counts?.[section.countKey]
                        : undefined;
                      const href = destination(section.href);
                      return (
                        <SidebarMenuItem key={section.href}>
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
                                activeHref === section.href ? "page" : undefined
                              }
                              onPointerEnter={() => prefetch(href)}
                              onFocus={() => prefetch(href)}
                              onTouchStart={() => prefetch(href)}
                              onClick={() => setOpenMobile(false)}
                            >
                              <Icon aria-hidden="true" />
                              <span className="truncate">
                                {t(section.label)}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                          {count ? (
                            <SidebarMenuBadge aria-hidden="true">
                              {count}
                            </SidebarMenuBadge>
                          ) : null}
                        </SidebarMenuItem>
                      );
                    })}
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
                className="w-72 max-w-[calc(100vw-1.5rem)]"
              >
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {name}
                  </span>
                  {scope ? (
                    <span className="text-pretty">{t("scope", { scope })}</span>
                  ) : null}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
