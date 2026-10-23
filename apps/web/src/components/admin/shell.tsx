"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/loading";
import { orpc } from "@/lib/web/api";
import { authClient } from "@/lib/web/auth-client";
import { cx } from "@/lib/web/cx";
import { ErrorPanel } from "./error-panel";
import { ADMIN_SECTIONS } from "./nav";
import { AdminSignIn } from "./sign-in";
import { type Staff, StaffProvider } from "./staff-context";

/**
 * The staff layout: gates everything beneath it on `me.get`.
 *
 * This is presentation only. Hiding the screens from someone without a staff
 * role keeps them from a dead end; the authorization that matters is enforced
 * by every procedure on the server.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const queryClient = useQueryClient();
  const me = useQuery(orpc.me.get.queryOptions());

  const signOut = async () => {
    await authClient.signOut();
    await queryClient.invalidateQueries();
  };

  if (me.isPending) {
    return (
      <main id="contenido" className="container-page flex flex-col gap-4 py-10">
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <Placeholder className="h-12 w-64" />
        <Placeholder className="h-48" />
      </main>
    );
  }

  if (me.isError) {
    return (
      <main id="contenido" className="container-page py-10">
        <ErrorPanel error={me.error} onRetry={() => me.refetch()} />
      </main>
    );
  }

  const viewer = me.data;
  if (viewer.kind === "anonymous") return <AdminSignIn />;

  if (viewer.staffRole === "none") {
    return (
      <main
        id="contenido"
        className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10"
      >
        <Logo label={t("title")} />
        <div className="flex items-start gap-3 rounded-card bg-card p-5 shadow-ring">
          <ShieldAlert
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-ink-2"
          />
          <p className="t-body">{t("notStaff")}</p>
        </div>
        <Button onClick={signOut} block>
          <LogOut aria-hidden />
          {t("signOut")}
        </Button>
      </main>
    );
  }

  const staff: Staff = { ...viewer, staffRole: viewer.staffRole };

  return (
    <StaffProvider value={staff}>
      <Chrome staff={staff} onSignOut={signOut}>
        {children}
      </Chrome>
    </StaffProvider>
  );
}

function Chrome({
  staff,
  onSignOut,
  children,
}: {
  staff: Staff;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  const isCurrent = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="container-page flex items-center justify-between gap-4 py-3">
          <Link href="/admin" className="rounded-full">
            <Logo label={t("title")} />
          </Link>
          <div className="flex items-center gap-2">
            <p className="t-small hidden text-ink-2 md:block">
              {staff.displayName
                ? t("shell.signedInAs", { name: staff.displayName })
                : null}
            </p>
            <Button size="sm" variant="ghost" onClick={onSignOut}>
              <LogOut aria-hidden />
              {t("signOut")}
            </Button>
          </div>
        </div>
        <nav
          aria-label={t("shell.nav")}
          className="container-page scrollbar-none flex gap-1 overflow-x-auto pb-2"
        >
          {ADMIN_SECTIONS.filter(
            (section) => !section.adminOnly || staff.staffRole === "admin",
          ).map(({ href, label, icon: Icon }) => {
            const current = isCurrent(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "press inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-[15px] whitespace-nowrap md:h-10",
                  current
                    ? "bg-ink font-medium text-paper"
                    : "text-ink-2 hover:bg-paper-3 hover:text-ink",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {t(label)}
              </Link>
            );
          })}
        </nav>
      </header>

      <main
        id="contenido"
        className="container-page flex flex-col gap-6 py-6 md:py-10"
      >
        <ScopeLine staff={staff} />
        {children}
      </main>
    </div>
  );
}

/** Who this person may act for: the province, or the municipality they run. */
function ScopeLine({ staff }: { staff: Staff }) {
  const t = useTranslations("admin");
  const municipalities = useQuery(orpc.municipalities.list.queryOptions());
  const { staffScope } = staff;

  const scope = Array.isArray(staffScope)
    ? staffScope
        .map(
          (id) =>
            municipalities.data?.find((item) => item.id === id)?.name ?? "",
        )
        .filter(Boolean)
        .join(", ")
    : t("province");

  if (!scope) return null;
  return (
    <p className="t-small text-ink-2">
      <span className="font-medium text-ink">
        {staff.staffRole === "admin"
          ? t("shell.roleAdmin")
          : t("shell.roleModerator")}
        .
      </span>{" "}
      {t("scope", { scope })}
    </p>
  );
}
