import {
  Compass,
  House,
  Map as MapIcon,
  MapPinPlus,
  MessagesSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SavedPlaces } from "@/components/map/saved-places";
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
 * Every destination is an icon over a word. Icon-only would be shorter and
 * would also be a quiz; the contest asks for a product usable without training,
 * and a word under a picture is what makes that true for someone who has never
 * seen the app before.
 *
 * Hidden below `md`. On a phone there is no width to spare either, so the same
 * controls float over the map as separate circles instead.
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
      className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center text-[11px] leading-tight transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "bg-accent text-foreground" : "text-muted-foreground"
      }`}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}

/**
 * Who you are, and what is waiting for you.
 *
 * `floating` is the phone: each control is its own circle over the map, with
 * its own ring and shadow, rather than a bar of chrome sitting on top of it.
 * `rail` is the column on a wider screen, where the surface behind them is
 * already a panel.
 */
async function RailAccount({
  layout = "rail",
}: {
  layout?: "rail" | "floating";
}) {
  const viewer = await getServerViewer();
  const t = await getTranslations("shell");

  const floating =
    layout === "floating"
      ? "rounded-full border bg-background/95 shadow-md backdrop-blur-sm"
      : "";

  if (viewer.kind === "anonymous") {
    return (
      <Button
        variant="ghost"
        size="icon-lg"
        className={`size-11 rounded-full ${floating}`}
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
    <div
      className={
        layout === "floating"
          ? "flex items-center gap-2 [&>*]:size-11 [&>*]:shrink-0"
          : "flex flex-col items-center gap-1"
      }
    >
      <SavedPlaces className={floating} />
      <NotificationBell className={floating} />
      <UserMenu
        className={floating}
        viewer={{
          kind: viewer.kind,
          displayName: viewer.profile.displayName,
          image: viewer.image,
          cedulaStatus: viewer.profile.cedulaStatus,
        }}
      />
    </div>
  );
}

/**
 * The account controls on a phone live in `MapAccountCluster`
 * (`./map-account-cluster`), next to the search field: one avatar that fans
 * the rest out, so the category chips below keep the full width.
 */

/** The desk link, for the handful of accounts that have one. */
async function ModerationLink() {
  const viewer = await getServerViewer();
  if (viewer.kind !== "citizen" || viewer.profile.staffRole === "none") {
    return null;
  }

  const t = await getTranslations("map.rail");

  return (
    <RailLink href="/moderacion" icon={ShieldCheck} label={t("moderation")} />
  );
}

export async function MapRail() {
  const t = await getTranslations("map.rail");

  return (
    <nav
      aria-label={t("label")}
      className="hidden w-[76px] shrink-0 flex-col border-r bg-background md:flex"
    >
      <div className="flex flex-1 flex-col gap-1 p-2">
        <RailLink href="/" icon={House} label={t("home")} />
        <RailLink href="/explorar" icon={Compass} label={t("explore")} />
        <RailLink href="/mapa" icon={MapIcon} label={t("map")} active />
        {/* The URL carries the mode, so this works from anywhere and the back
            button gets out of it. */}
        <RailLink
          href="/mapa?agregar=true"
          icon={MapPinPlus}
          label={t("addPlace")}
        />
        <RailLink
          href="/consultas"
          icon={MessagesSquare}
          label={t("consultations")}
        />
        <Suspense fallback={null}>
          <ModerationLink />
        </Suspense>
      </div>

      <div className="flex flex-col items-center gap-1 border-t p-2">
        <Suspense fallback={<div className="size-11" aria-hidden />}>
          <RailAccount />
        </Suspense>
      </div>
    </nav>
  );
}
