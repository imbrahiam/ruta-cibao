"use client";

import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-context";
import { UserMenu } from "@/components/shell/user-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

const floating =
  "rounded-full border bg-background/95 shadow-md backdrop-blur-sm";

/**
 * The account control on a phone: one avatar, nothing else.
 *
 * Saved places and notifications used to hang below it as their own floating
 * circles, competing with search, the category chips and the map itself for
 * space. They are secondary actions, so they live on the "Mi cuenta" screen,
 * one tap away in the bottom bar. The avatar keeps a badge while anything is
 * unread, so the signal survives without spending a permanent button on it.
 */
export function MapAccountCluster() {
  const t = useTranslations("shell");
  const notificationsT = useTranslations("notifications");
  const { viewer, isLoading } = useAuth();
  const signedIn = viewer !== undefined && viewer.kind !== "anonymous";

  const unreadQuery = useQuery({
    ...orpc.notifications.list.queryOptions({ input: { limit: 1 } }),
    enabled: signedIn,
  });
  const unread = unreadQuery.data?.unread ?? 0;

  if (isLoading || viewer === undefined) {
    return <div className="size-11" aria-hidden />;
  }

  // Narrowing on `kind` (not the `signedIn` boolean) is what lets the
  // `UserMenu` below receive a viewer that is never anonymous.
  if (viewer.kind === "anonymous") {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("size-11", floating)}
        nativeButton={false}
        render={
          <Link href="/entrar" aria-label={t("signIn")} title={t("signIn")} />
        }
      >
        <UserRound className="size-5" aria-hidden />
      </Button>
    );
  }

  return (
    <span className="relative block size-11 shrink-0">
      <UserMenu
        viewer={{
          kind: viewer.kind,
          displayName: viewer.displayName ?? "",
          image: viewer.image,
          cedulaStatus: viewer.cedulaStatus,
        }}
        className={floating}
      />
      {unread > 0 && (
        <Badge
          variant="destructive"
          aria-hidden
          className="pointer-events-none absolute -top-0.5 -right-0.5 h-5 min-w-5 justify-center rounded-full px-1 text-[11px] tabular-nums"
        >
          {unread > 9 ? "9+" : unread}
        </Badge>
      )}
      <span className="sr-only">
        {unread > 0
          ? notificationsT("openWithCount", { count: unread })
          : notificationsT("open")}
      </span>
    </span>
  );
}
