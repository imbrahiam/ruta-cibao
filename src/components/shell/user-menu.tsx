"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  ChevronRight,
  ClipboardList,
  IdCard,
  LogOut,
  MessageCircleQuestionMark,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { ASSISTANT_OPEN_EVENT } from "@/components/assistant/assistant-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

export type ViewerSummary = {
  kind: "visitor" | "citizen";
  displayName: string;
  image: string | null;
  cedulaStatus: string | null;
};

/** First letters of the name, for people with no photo. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .replace(/[^\p{L}]/gu, "")
    .toUpperCase();
}

function AccountAvatar({
  viewer,
  className,
}: {
  viewer: ViewerSummary;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      {viewer.image ? (
        <AvatarImage src={viewer.image} alt="" referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className="text-xs">
        {/* An account created with a phone number has digits where a
            name would be, and "80" is not an initial. */}
        {initials(viewer.displayName) || (
          <User className="size-4" aria-hidden />
        )}
      </AvatarFallback>
    </Avatar>
  );
}

function TriggerButton({
  viewer,
  label,
  className,
  ...props
}: {
  viewer: ViewerSummary;
  label: string;
  className?: string;
} & React.ComponentProps<typeof Button>) {
  // `...props` carries what the drawer/dropdown trigger injects (open handler,
  // pressed state, ref). Swallow any of it and the button goes dead.
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-11 rounded-full", className)}
      aria-label={label}
      {...props}
    >
      <AccountAvatar viewer={viewer} className="size-9" />
    </Button>
  );
}

function ResidencyLine({ viewer }: { viewer: ViewerSummary }) {
  const t = useTranslations("shell");
  return (
    <span className="flex items-center gap-1.5 font-normal text-muted-foreground text-xs">
      {viewer.kind === "citizen" ? (
        <>
          <BadgeCheck
            className="size-3.5 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          {t("resident")}
        </>
      ) : (
        <>
          <User className="size-3.5" aria-hidden />
          {t("visitor")}
        </>
      )}
    </span>
  );
}

/**
 * A row in the mobile drawer.
 *
 * Full-height thumb targets with room between them, and a chevron marking
 * what navigates somewhere — so "Salir" and "Preguntar" read as actions,
 * not as more places to go.
 */
function DrawerRow({
  href,
  icon: Icon,
  onNavigate,
  children,
}: {
  href: string;
  icon: typeof User;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-base transition-colors hover:bg-secondary active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </Link>
  );
}

function DrawerAction({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof User;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-base transition-colors hover:bg-secondary active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

/**
 * Who you are, and where your things live.
 *
 * A bottom drawer on a phone and a dropdown on a wider screen, swapped with
 * `display` rather than a media-query hook — so there is no hydration mismatch
 * and, because `display: none` removes an element from the accessibility tree,
 * no duplicate button in the tab order. The notification bell and the saved
 * list do the same.
 *
 * The drawer matters: a dropdown anchored to the top-right corner hangs where
 * the thumb cannot reach, floats over the map without a dismiss affordance,
 * and crams seven actions against the screen edge. The drawer sits by the
 * thumb, carries a swipe handle, gives every row full height, and parks sign
 * out on its own past a separator — where it cannot be tapped by accident.
 */
export function UserMenu({
  viewer,
  className,
}: {
  viewer: ViewerSummary;
  className?: string;
}) {
  const t = useTranslations("shell");
  const savedT = useTranslations("map.saved");
  const notificationsT = useTranslations("notifications");
  const assistantT = useTranslations("assistant");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Same query (and key) the avatar badge reads, so the menu count costs no
  // extra request: what the badge announces is what this entry names.
  const unreadQuery = useQuery(
    orpc.notifications.list.queryOptions({ input: { limit: 1 } }),
  );
  const unread = unreadQuery.data?.unread ?? 0;

  async function handleSignOut() {
    const result = await signOut();
    if (result.error) {
      toast.error(t("signOutFailed"));
      return;
    }
    queryClient.clear();
    setDrawerOpen(false);
    router.refresh();
  }

  function openAssistant() {
    // The search suggestions hand over the same way: fold the drawer away
    // first, then let the assistant open on top of a settled screen.
    setDrawerOpen(false);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT));
    }, 150);
  }

  const closeDrawer = () => setDrawerOpen(false);
  const notificationsLabel =
    unread > 0
      ? notificationsT("openWithCount", { count: unread })
      : notificationsT("open");

  return (
    <>
      <div className="md:hidden">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} showSwipeHandle>
          <DrawerTrigger
            render={
              <TriggerButton
                viewer={viewer}
                label={t("account")}
                className={className}
              />
            }
          />
          <DrawerContent>
            <DrawerHeader className="items-center">
              <AccountAvatar viewer={viewer} className="size-14" />
              <DrawerTitle className="text-lg">
                {viewer.displayName}
              </DrawerTitle>
              <ResidencyLine viewer={viewer} />
            </DrawerHeader>

            <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
              <DrawerRow href="/cuenta" icon={User} onNavigate={closeDrawer}>
                {t("account")}
              </DrawerRow>
              <DrawerRow
                href="/aportes"
                icon={ClipboardList}
                onNavigate={closeDrawer}
              >
                {t("contributions")}
              </DrawerRow>
              {/* Secondary map actions, folded into the account rather than
                  floating over the map as their own circles: saved and
                  notifications live on the "Mi cuenta" screen. */}
              <DrawerRow
                href="/cuenta#guardados"
                icon={Bookmark}
                onNavigate={closeDrawer}
              >
                {savedT("title")}
              </DrawerRow>
              <DrawerRow
                href="/cuenta#avisos"
                icon={Bell}
                onNavigate={closeDrawer}
              >
                {notificationsLabel}
              </DrawerRow>
              <DrawerAction
                icon={MessageCircleQuestionMark}
                onClick={openAssistant}
              >
                {assistantT("title")}
              </DrawerAction>

              {/* The one action a visitor most likely wants, surfaced rather
                  than buried in a settings page they would have to go looking
                  for. */}
              {viewer.kind === "visitor" && (
                <DrawerRow
                  href="/verificar"
                  icon={IdCard}
                  onNavigate={closeDrawer}
                >
                  {t("becomeResident")}
                </DrawerRow>
              )}

              <Separator className="my-2" />

              <DrawerAction icon={LogOut} onClick={() => void handleSignOut()}>
                {t("signOut")}
              </DrawerAction>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <TriggerButton
                viewer={viewer}
                label={t("account")}
                className={className}
              />
            }
          />

          <DropdownMenuContent align="end" className="w-64">
            {/* Base UI requires a group around a group label — unlike Radix,
                where the label stands alone. Without it the menu throws
                "MenuGroupContext is missing" at render. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="font-medium text-sm">
                  {viewer.displayName}
                </span>
                <ResidencyLine viewer={viewer} />
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              nativeButton={false}
              render={<Link href="/cuenta" />}
            >
              <User className="size-4" aria-hidden />
              {t("account")}
            </DropdownMenuItem>
            <DropdownMenuItem
              nativeButton={false}
              render={<Link href="/aportes" />}
            >
              <ClipboardList className="size-4" aria-hidden />
              {t("contributions")}
            </DropdownMenuItem>
            <DropdownMenuItem
              nativeButton={false}
              render={<Link href="/cuenta#guardados" />}
            >
              <Bookmark className="size-4" aria-hidden />
              {savedT("title")}
            </DropdownMenuItem>
            <DropdownMenuItem
              nativeButton={false}
              render={<Link href="/cuenta#avisos" />}
            >
              <Bell className="size-4" aria-hidden />
              {notificationsLabel}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT));
              }}
            >
              <MessageCircleQuestionMark className="size-4" aria-hidden />
              {assistantT("title")}
            </DropdownMenuItem>

            {/* The one action a visitor most likely wants, surfaced rather than
                buried in a settings page they would have to go looking for. */}
            {/* `nativeButton={false}` because the render prop produces an <a>:
                Base UI must be told not to assume button semantics it will not get. */}
            {viewer.kind === "visitor" && (
              <DropdownMenuItem
                nativeButton={false}
                render={<Link href="/verificar" />}
              >
                <IdCard className="size-4" aria-hidden />
                {t("becomeResident")}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => void handleSignOut()}>
              <LogOut className="size-4" aria-hidden />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
