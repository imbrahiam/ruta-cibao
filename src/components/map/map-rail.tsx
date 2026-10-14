import {
  Compass,
  Map as MapIcon,
  MapPin,
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
/**
 * One destination on the desktop rail — the same item as the phone's bottom
 * bar, turned on its side: a soft grey pill behind the icon, the word under
 * it, a dot for the current page. One navigation shape across the product.
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
      className={`group flex w-full flex-col items-center gap-1 rounded-xl py-1.5 text-center text-[11.5px] leading-tight tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2 ${
        active
          ? "font-semibold text-foreground"
          : "font-medium text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="relative flex h-8 w-14 items-center justify-center">
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full transition-colors ${
            active
              ? "nav-pill bg-foreground/[0.08]"
              : "group-hover:bg-foreground/[0.05]"
          }`}
        />
        <Icon
          className="relative size-[22px]"
          strokeWidth={active ? 2.25 : 1.75}
          aria-hidden
        />
      </span>
      {label}
      <span
        aria-hidden
        className={`size-1 rounded-full ${active ? "bg-foreground" : "bg-transparent"}`}
      />
    </Link>
  );
}

/** Home, as the brand's own tile: the mark the login and header carry. */
function RailHome({ label }: { label: string }) {
  return (
    <Link
      href="/"
      className="group mb-2 flex w-full flex-col items-center gap-1.5 rounded-xl py-1.5 font-medium text-[11.5px] text-muted-foreground leading-tight hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="flex size-10 items-center justify-center rounded-[12px] bg-primary text-primary-foreground transition-transform group-active:scale-95">
        <MapPin className="size-5" aria-hidden />
      </span>
      {label}
    </Link>
  );
}

async function RailAccount({
  layout = "rail",
}: {
  layout?: "rail" | "floating";
}) {
  const viewer = await getServerViewer();
  const t = await getTranslations("shell");

  const floating =
    layout === "floating"
      ? "rounded-full border border-black/5 bg-background shadow-[0_2px_10px_-2px_rgb(0_0_0/0.18)]"
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
      className="hidden w-[84px] shrink-0 flex-col border-r bg-background md:flex"
    >
      <div className="flex flex-1 flex-col gap-1 px-2 pt-4 pb-2">
        <RailHome label={t("home")} />
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
