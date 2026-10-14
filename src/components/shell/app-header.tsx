import { UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Brand } from "@/components/shell/brand";
import { HeaderScrollFade } from "@/components/shell/header-scroll-fade";
import { SiteNav } from "@/components/shell/site-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getServerViewer } from "@/modules/access/server";

/**
 * The account controls.
 *
 * Split out and wrapped in Suspense by the header, because this is the only
 * part that depends on who is asking. Keeping it separate is what lets the rest
 * of every page prerender: the header, the title and the content are all in the
 * static shell, and only this corner streams in.
 */
async function AccountArea() {
  const viewer = await getServerViewer();
  const t = await getTranslations("shell");

  if (viewer.kind === "anonymous") {
    return (
      <>
        {/* On a phone the header has one job and no room to argue about it: a
            circle you press to become someone. The word comes back as soon as
            there is width for it. */}
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon"
          className="size-11 rounded-full sm:hidden"
          render={
            <Link href="/entrar" aria-label={t("signIn")} title={t("signIn")} />
          }
        >
          <UserRound className="size-5" aria-hidden />
        </Button>

        <Button
          nativeButton={false}
          variant="default"
          className="hidden h-11 rounded-full px-6 shadow-sm sm:inline-flex"
          render={<Link href="/entrar" />}
        >
          {t("signIn")}
        </Button>
      </>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <NotificationBell />
      <UserMenu
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

/** Reserves the account area's width so nothing shifts when it arrives. */
function AccountAreaFallback() {
  return <div className="size-11" aria-hidden />;
}

export async function AppHeader() {
  const t = await getTranslations("app");

  return (
    <header className="sticky top-0 z-40 bg-background">
      {/* Standard, invisible until focused, and the first thing a keyboard or
          screen-reader user reaches. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        {t("skipToContent")}
      </a>

      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6 md:h-[4.5rem]">
        <Brand />
        <SiteNav />

        <Suspense fallback={<AccountAreaFallback />}>
          <AccountArea />
        </Suspense>
      </div>
      <HeaderScrollFade />
    </header>
  );
}
