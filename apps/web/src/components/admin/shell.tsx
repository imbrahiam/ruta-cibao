"use client";

import { useQuery } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/loading";
import { orpc } from "@/lib/web/api";
import { authClient } from "@/lib/web/auth-client";
import { ErrorPanel, InlineError } from "./error-panel";
import { AdminPageTitleProvider } from "./page-frame";
import { useResetAdminSession } from "./providers";
import { AdminSignIn } from "./sign-in";
import { isStaffViewer, StaffProvider } from "./staff-context";
import { AdminWorkspace } from "./workspace";

/** Presentation gate only; every procedure still enforces staff authorization. */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const resetSession = useResetAdminSession();
  const me = useQuery(orpc.me.get.queryOptions());
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<unknown>(null);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw result.error;
      resetSession();
    } catch (error) {
      setSignOutError(error);
    } finally {
      setSigningOut(false);
    }
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

  if (!isStaffViewer(viewer)) {
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
        <Button onClick={signOut} block disabled={signingOut}>
          <LogOut aria-hidden />
          {t(signingOut ? "loading" : "signOut")}
        </Button>
        <InlineError error={signOutError} />
      </main>
    );
  }

  return (
    <StaffProvider value={viewer}>
      <AdminPageTitleProvider>
        <AdminWorkspace
          staff={viewer}
          onSignOut={signOut}
          signingOut={signingOut}
          signOutError={signOutError}
        >
          {children}
        </AdminWorkspace>
      </AdminPageTitleProvider>
    </StaffProvider>
  );
}
