import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
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
      <Button variant="ghost" className="h-11" render={<Link href="/entrar" />}>
        {t("signIn")}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
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

/** Reserves the account area's width so nothing shifts when it arrives. */
function AccountAreaFallback() {
  return <div className="size-11" aria-hidden />;
}

export async function AppHeader({ locale }: { locale: string }) {
  // Explicit locale: `getTranslations()` without one reads the request config,
  // which is a runtime access and would pull every page below out of the
  // static shell.
  const t = await getTranslations({ locale, namespace: "app" });

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
      {/* Standard, invisible until focused, and the first thing a keyboard or
          screen-reader user reaches. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        {t("skipToContent")}
      </a>

      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-3">
        <Link href="/" className="font-semibold text-base tracking-tight">
          {t("name")}
        </Link>

        <Suspense fallback={<AccountAreaFallback />}>
          <AccountArea />
        </Suspense>
      </div>
    </header>
  );
}
