"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { useState } from "react";
import { NotificationList } from "@/components/notifications/notification-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRealtime } from "@/hooks/use-realtime";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/**
 * The unread count, kept current by the live stream rather than by polling.
 *
 * One drawer for every viewport: a bottom sheet on a phone, the same floating
 * side panel the search drawer uses on a wider screen. A single container
 * matters because the panel portals to `document.body` — hiding a second
 * container with `display: none` would hide its trigger but not its portalled
 * panel, so two drawers would open at once. The pill only travels with the
 * bottom sheet; the side panel has no swipe handle.
 */
function BellButton({
  unread,
  label,
  className,
  ...props
}: {
  unread: number;
  label: string;
  className?: string;
} & React.ComponentProps<typeof Button>) {
  // `...props` carries what the drawer trigger injects (open handler,
  // pressed state, ref). Swallow any of it and the button goes dead.
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative size-11", className)}
      aria-label={label}
      {...props}
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <Badge
          variant="destructive"
          className="-top-0.5 -right-0.5 absolute h-5 min-w-5 justify-center rounded-full px-1 text-[11px] tabular-nums"
        >
          {unread > 9 ? "9+" : unread}
        </Badge>
      )}
    </Button>
  );
}

export function NotificationBell({
  className,
  onOpen,
  open: controlledOpen,
  onOpenChange,
}: {
  className?: string;
  /** Fires when either container opens, so an owner can stand down. */
  onOpen?: () => void;
  /**
   * Controlled open state. When omitted the panel manages itself; when given
   * — the account screen drives it from the URL hash — both containers follow
   * it, and only the visible one matters.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const query = useQuery(
    orpc.notifications.list.queryOptions({ input: { limit: 20 } }),
  );
  const unread = query.data?.unread ?? 0;

  // No channels asked for: the session grants this viewer's own channel, and
  // nothing else should cost them data.
  useRealtime({ channels: [], onEvent: () => queryClient.invalidateQueries() });

  const label = unread > 0 ? t("openWithCount", { count: unread }) : t("open");

  function handleOpenChange(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
    if (next) onOpen?.();
  }

  function close() {
    handleOpenChange(false);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <DrawerTrigger
        render={
          <BellButton unread={unread} label={label} className={className} />
        }
      />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("title")}</DrawerTitle>
        </DrawerHeader>
        <NotificationList onNavigate={close} />
      </DrawerContent>
    </Drawer>
  );
}
