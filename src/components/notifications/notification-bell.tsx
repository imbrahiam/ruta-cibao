"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useRealtime } from "@/hooks/use-realtime";
import { orpc } from "@/lib/orpc";

/**
 * The unread count, kept current by the live stream rather than by polling.
 *
 * The panel is a bottom drawer on a phone and a side sheet on a wider screen.
 * The two are swapped with `display`, not a media-query hook, so there is no
 * hydration mismatch and — because `display: none` removes an element from the
 * accessibility tree — no duplicate button in the tab order.
 */
function BellButton({ unread, label }: { unread: number; label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-11"
      aria-label={label}
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

export function NotificationBell() {
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const query = useQuery(
    orpc.notifications.list.queryOptions({ input: { limit: 20 } }),
  );
  const unread = query.data?.unread ?? 0;

  // No channels asked for: the session grants this viewer's own channel, and
  // nothing else should cost them data.
  useRealtime({ channels: [], onEvent: () => queryClient.invalidateQueries() });

  const label = unread > 0 ? t("openWithCount", { count: unread }) : t("open");

  return (
    <>
      <div className="md:hidden">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger
            render={<BellButton unread={unread} label={label} />}
          />
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{t("title")}</DrawerTitle>
            </DrawerHeader>
            <NotificationList onNavigate={() => setDrawerOpen(false)} />
          </DrawerContent>
        </Drawer>
      </div>

      <div className="hidden md:block">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger render={<BellButton unread={unread} label={label} />} />
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{t("title")}</SheetTitle>
            </SheetHeader>
            <NotificationList onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
