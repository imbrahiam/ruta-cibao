"use client";

import { useQuery } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { Logo, RoadMark } from "@/components/brand/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
      // The session check is a few hundred milliseconds: a drawn-out skeleton of a
      // desk the visitor may not even be allowed into reads as a glitch. Stay quiet,
      // and only if it drags on let the mark appear.
      <div
        role="status"
        aria-busy="true"
        className="grid min-h-dvh place-items-center"
      >
        <span className="sr-only">{t("loading")}</span>
        <RoadMark
          size={44}
          className="animate-fade [animation-delay:600ms] [animation-duration:400ms]"
        />
      </div>
    );
  }

  if (me.isError) {
    return (
      <main
        id="contenido"
        className="mx-auto w-full max-w-[1520px] px-4 py-10 sm:px-6 lg:px-10"
      >
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
        <Alert>
          <ShieldAlert aria-hidden="true" />
          <AlertDescription>{t("notStaff")}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={signOut}
          disabled={signingOut}
          className="w-full"
        >
          <LogOut aria-hidden="true" />
          {t("signOut")}
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
