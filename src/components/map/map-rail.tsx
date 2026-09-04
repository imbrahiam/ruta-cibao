import {
  Bookmark,
  Home,
  Map as MapIcon,
  MessageSquareWarning,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getServerViewer } from "@/modules/access/server";

/**
 * The map's navigation, as a rail rather than a header.
 *
 * A map wants every pixel of height it can get, and a header takes a band off
 * the top of the one thing the page exists to show. A rail down the side costs
 * width, which a map has more of to spare, and puts the controls where a thumb
 * is not — leaving the bottom of the screen for the drawer.
 *
 * Hidden below `md`. On a phone there is no width to spare either, so the same
 * controls sit in a compact cluster over the map instead.
 */
function RailLink({
  href,
  icon: Icon,
  label,
  active = false,
}: {
  href: string;
  icon: typeof MapIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-center text-[11px] leading-tight transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}

async function RailAccount() {
  const viewer = await getServerViewer();
  const t = await getTranslations("shell");

  if (viewer.kind === "anonymous") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-auto py-2 text-xs"
        render={<Link href="/entrar" />}
      >
        {t("signIn")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <NotificationBell />
      <UserMenu
        viewer={{
          kind: viewer.kind,
          displayName: viewer.profile.displayName,
          cedulaStatus: viewer.profile.cedulaStatus,
        }}
      />
    </div>
  );
}

/**
 * The same account controls, for a screen with no room for a rail.
 *
 * Floats over the top-right corner of the map, clear of the search field on the
 * left and of the drawer that rises from the bottom.
 */
export function MapAccountCluster() {
  return (
    <div className="absolute top-3 right-3 z-30 flex items-center gap-1 rounded-full border bg-background/95 px-1 py-1 shadow-md backdrop-blur-sm md:hidden">
      <Suspense fallback={<div className="size-11" aria-hidden />}>
        <RailAccount />
      </Suspense>
    </div>
  );
}

export async function MapRail() {
  const t = await getTranslations("map.rail");

  return (
    <nav
      aria-label={t("label")}
      className="hidden w-[76px] shrink-0 flex-col border-r bg-background md:flex"
    >
      <Link
        href="/"
        className="flex h-14 items-center justify-center border-b font-semibold text-sm"
        aria-label={t("home")}
      >
        RC
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-2">
        <RailLink href="/mapa" icon={MapIcon} label={t("map")} active />
        <RailLink href="/" icon={Home} label={t("home")} />
        {/* Both land on the map for now; each becomes its own screen as the
            feature that owns it is built, and the rail does not change. */}
        <RailLink href="/mapa?cat=" icon={Bookmark} label={t("saved")} />
        <RailLink
          href="/mapa"
          icon={MessageSquareWarning}
          label={t("report")}
        />
      </div>

      <div className="flex flex-col items-center gap-1 border-t p-2">
        <Suspense fallback={<div className="size-11" aria-hidden />}>
          <RailAccount />
        </Suspense>
      </div>
    </nav>
  );
}
