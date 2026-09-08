"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BellOff,
  ClipboardList,
  Fingerprint,
  LogOut,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { SavedPlaces } from "@/components/map/saved-places";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient, signOut } from "@/lib/auth-client";

export function AccountScreen() {
  const t = useTranslations("account");
  const shellT = useTranslations("shell");
  const notificationsT = useTranslations("notifications");
  const { viewer, isLoading, isUnavailable } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const passkeySupport = usePasskeySupport();
  const push = usePushSubscription();
  const [isRegistering, startRegistering] = useTransition();

  /**
   * Whether this account already has a passkey.
   *
   * Asked of the server rather than remembered in a `useState` that reset on
   * every reload. That local flag was why the invitation kept coming back to
   * somebody who had already accepted it — and worse, why pressing it then
   * failed: WebAuthn passes the existing credentials as `excludeCredentials`,
   * so an authenticator being asked to register a second time for the same
   * account refuses with `InvalidStateError`. The offer and the failure were
   * the same bug.
   */
  const passkeys = useQuery({
    queryKey: ["passkeys"],
    enabled: passkeySupport === "available",
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error: listError } =
        await authClient.passkey.listUserPasskeys();
      if (listError) throw new Error(listError.message ?? "passkeys");
      return data ?? [];
    },
  });

  const hasPasskey = (passkeys.data?.length ?? 0) > 0;
  /**
   * Which panel the URL hash asks for, if any.
   *
   * The account menu links here with `#avisos` / `#guardados`, and arriving
   * must open that panel — otherwise the tap looks dead. Kept in sync both
   * ways: landing with a hash opens, closing drops the hash so the back
   * button leaves the page instead of reopening the panel.
   */
  const [panel, setPanel] = useState<"avisos" | "guardados" | null>(null);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash;
      setPanel(
        hash === "#avisos"
          ? "avisos"
          : hash === "#guardados"
            ? "guardados"
            : null,
      );
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function closePanel() {
    setPanel(null);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }

  /**
   * Makes good on what the sign-in screen promises.
   *
   * Someone who tried the fingerprint button before having an account is told
   * to sign in and enable it here afterwards — so "here" has to exist. A
   * security setting, not navigation, which is why it lives on this screen
   * rather than in the account menu. Offered only where the device can
   * complete the ceremony.
   */
  function addPasskey() {
    startRegistering(async () => {
      const { error: registerError } = await authClient.passkey.addPasskey({
        authenticatorAttachment: "platform",
      });

      if (registerError) {
        // Logged as well as shown. A ceremony can fail for a dozen reasons —
        // the person cancelled, the device has no screen lock, the origin does
        // not match the relying party — and a toast that says only "no se pudo"
        // leaves nobody, including whoever has to fix it, any the wiser.
        console.error("passkey registration failed", registerError);
        // The one case worth its own sentence: this device already holds a
        // passkey for this account, so there is nothing to do and nothing
        // wrong. The browser reports it as `InvalidStateError`, which reaches
        // us as a message rather than a code.
        const already =
          registerError.status === 409 ||
          /invalidstate/i.test(registerError.message ?? "");

        toast.error(shellT(already ? "passkeyAlready" : "passkeyFailed"));
        await passkeys.refetch();
        return;
      }

      await passkeys.refetch();
      toast.success(shellT("passkeyAdded"));
    });
  }
  if (isLoading)
    return (
      <p
        className="flex justify-center gap-2 py-16 text-sm text-muted-foreground"
        role="status"
      >
        <Spinner className="size-4" />
        {t("loading")}
      </p>
    );
  if (isUnavailable)
    return (
      <div role="alert" className="surface-card p-8 text-center">
        <p>{t("error")}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          {t("retry")}
        </Button>
      </div>
    );
  const member = viewer && viewer.kind !== "anonymous";
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        {t("eyebrow")}
      </p>
      <h1 className="mb-8 text-4xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <section className="surface-card mb-6 flex flex-col gap-5 p-7 sm:flex-row sm:items-center">
        {member && viewer.image ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl">
            <Image
              src={viewer.image}
              alt=""
              fill
              sizes="3.5rem"
              className="object-cover"
              referrerPolicy="no-referrer"
              unoptimized
            />
          </span>
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
            <UserRound className="size-6" aria-hidden />
          </span>
        )}
        <div className="flex-1">
          <h2 className="text-xl font-medium tracking-tight">
            {member ? viewer.displayName : t("anonymousTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {member
              ? viewer.kind === "citizen"
                ? t("verified")
                : t("visitor")
              : t("anonymousBody")}
          </p>
        </div>
        {!member && (
          <Button
            className="h-11 self-start rounded-full px-5"
            nativeButton={false}
            render={<Link href="/entrar?callbackUrl=%2Fcuenta" />}
          >
            {t("signIn")}
          </Button>
        )}
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            { key: "contributions", href: "/aportes", icon: ClipboardList },
            { key: "install", href: "/instalar", icon: Smartphone },
            { key: "privacy", href: "/privacidad", icon: ShieldCheck },
            ...(member && viewer.kind === "visitor"
              ? [
                  {
                    key: "verification" as const,
                    href: "/verificar",
                    icon: Fingerprint,
                  },
                ]
              : []),
            ...(member && viewer.staffRole !== "none"
              ? [
                  {
                    key: "moderation" as const,
                    href: "/moderacion",
                    icon: ShieldCheck,
                  },
                ]
              : []),
          ] as const
        ).map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="surface-card flex items-start gap-4 p-6 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
            <div className="flex-1">
              <h2 className="font-medium">{t(key)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`${key}Hint`)}
              </p>
            </div>
            <ArrowUpRight
              className="size-4 text-muted-foreground"
              aria-hidden
            />
          </Link>
        ))}
        {member && (
          <>
            {/* No leading icon: the trigger on the right already is the bell,
                and a decorative twin only stretched the card. The hint stays
                to one short line so both cards keep the same compact height. */}
            <section
              id="avisos"
              className="surface-card flex scroll-mt-24 items-center gap-4 p-6"
            >
              <div className="flex-1">
                <h2 className="font-medium">{notificationsT("title")}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t("avisosHint")}
                </p>
              </div>
              <NotificationBell
                open={panel === "avisos"}
                onOpenChange={(next) => {
                  if (next) setPanel("avisos");
                  else closePanel();
                }}
              />
            </section>
            <section
              id="guardados"
              className="surface-card flex scroll-mt-24 items-center gap-4 p-6"
            >
              <div className="flex-1">
                <h2 className="font-medium">{t("saved")}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t("savedHint")}
                </p>
              </div>
              <SavedPlaces
                open={panel === "guardados"}
                onOpenChange={(next) => {
                  if (next) setPanel("guardados");
                  else closePanel();
                }}
              />
            </section>
          </>
        )}
      </div>
      {/* Nothing at all until the list has answered: offering to set up
          something already set up is worse than a moment with no card. */}
      {member && passkeySupport === "available" && passkeys.isSuccess && (
        <section className="surface-card mt-4 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          {hasPasskey ? (
            <BadgeCheck
              className="size-5 shrink-0 text-emerald-600"
              aria-hidden
            />
          ) : (
            <Fingerprint className="size-5 shrink-0 text-primary" aria-hidden />
          )}
          <div className="flex-1">
            <h2 className="font-medium">{t("passkey")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {hasPasskey ? t("passkeyActiveHint") : t("passkeyHint")}
            </p>
          </div>
          {hasPasskey ? (
            <p className="shrink-0 font-medium text-emerald-700 text-sm dark:text-emerald-400">
              {t("passkeyActive")}
            </p>
          ) : (
            <Button
              variant="outline"
              className="h-11 shrink-0 rounded-full px-5"
              disabled={isRegistering}
              onClick={addPasskey}
            >
              {isRegistering ? shellT("passkeyAdding") : shellT("addPasskey")}
            </Button>
          )}
        </section>
      )}
      {/* Per device, which is why it lives beside the passkey rather than in a
          settings list: both are things this browser can do that the account
          alone cannot, and both are meaningless on somebody else's phone. */}
      {member && push.state !== "unknown" && push.state !== "unsupported" && (
        <section className="surface-card mt-4 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          {push.state === "on" ? (
            <Bell className="size-5 shrink-0 text-primary" aria-hidden />
          ) : (
            <BellOff
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          <div className="flex-1">
            <h2 className="font-medium">{t("push")}</h2>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              {t(
                push.state === "denied"
                  ? "pushDeniedHint"
                  : push.state === "on"
                    ? "pushOnHint"
                    : "pushHint",
              )}
            </p>
          </div>
          {push.state !== "denied" && (
            <Button
              variant="outline"
              className="h-11 shrink-0 rounded-full px-5"
              disabled={push.pending}
              onClick={() =>
                void (push.state === "on" ? push.disable() : push.enable())
              }
            >
              {push.pending
                ? t("pushWorking")
                : push.state === "on"
                  ? t("pushOff")
                  : t("pushOn")}
            </Button>
          )}
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/explorar" />}
        >
          {t("explore")}
        </Button>
        {member && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(false);
              try {
                const result = await signOut();
                if (result.error) throw result.error;
                queryClient.clear();
                router.replace("/");
                router.refresh();
              } catch {
                setError(true);
              } finally {
                setPending(false);
              }
            }}
          >
            <LogOut aria-hidden />
            {t("signOut")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {t("error")}
        </p>
      )}
    </div>
  );
}
