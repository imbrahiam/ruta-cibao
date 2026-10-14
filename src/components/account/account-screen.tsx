"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  Bookmark,
  ChevronRight,
  ClipboardList,
  Fingerprint,
  LogOut,
  ShieldCheck,
  Smartphone,
  Stamp,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { SavedPlaces } from "@/components/map/saved-places";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-patterns/empty-state";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient, signOut } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

type RowIcon = typeof Bell;

/**
 * One line of the account page: a plain row under a bold heading.
 *
 * Settings the way a council website lists services: the name underlined so
 * it reads as something you press, a short hint under it, and either a chevron
 * (it goes somewhere) or a control at the edge (it does something here). No
 * cards — a ruled list is quicker to scan and costs nothing to draw.
 */
function AccountRow({
  icon: Icon,
  title,
  hint,
  href,
  onClick,
  aside,
  control,
}: {
  icon: RowIcon;
  title: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
  /** Short state shown before the chevron, such as a count. */
  aside?: ReactNode;
  /** A control at the edge, for rows that act in place. */
  control?: ReactNode;
}) {
  const pressable = Boolean(href || onClick);
  const body = (
    <>
      <Icon className="size-[22px] shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-semibold text-[17px] leading-snug",
            pressable &&
              "underline decoration-foreground/25 decoration-1 underline-offset-[5px] group-hover:decoration-foreground",
          )}
        >
          {title}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[15px] text-muted-foreground leading-snug">
            {hint}
          </span>
        )}
      </span>
      {aside}
      {pressable && (
        <ChevronRight
          className="size-5 shrink-0 text-muted-foreground/70"
          aria-hidden
        />
      )}
    </>
  );
  const shape =
    "group -mx-2 flex min-h-[72px] w-[calc(100%+1rem)] items-center gap-4 rounded-xl px-2 py-3 text-left";
  const press =
    "transition-colors hover:bg-secondary/70 active:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2";

  if (href) {
    return (
      <Link href={href} className={cn(shape, press)}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(shape, press)}>
        {body}
      </button>
    );
  }
  return (
    <div className={cn(shape, "flex-wrap sm:flex-nowrap")}>
      {body}
      {control && (
        <div className="w-full pl-[38px] sm:w-auto sm:pl-0">{control}</div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-1 font-bold text-lg tracking-[-0.01em]">{title}</h2>
      <ul className="ruled border-border border-y">{children}</ul>
    </section>
  );
}

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
  const member = Boolean(viewer && viewer.kind !== "anonymous");
  // The same queries the bell and the bookmark panel run, so these counts come
  // from the cache they already fill rather than costing a request of their own.
  const notifications = useQuery({
    ...orpc.notifications.list.queryOptions({ input: { limit: 20 } }),
    enabled: member,
  });
  const saved = useQuery({
    ...orpc.places.saved.queryOptions(),
    enabled: member,
  });
  const unread = notifications.data?.unread ?? 0;
  const savedCount = saved.data?.length ?? 0;

  function openPanel(next: "avisos" | "guardados") {
    setPanel(next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#${next}`,
    );
  }

  if (isLoading)
    return (
      <div role="status" className="mx-auto max-w-2xl space-y-4">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton aria-hidden className="h-9 w-40" />
        <div aria-hidden className="flex items-center gap-4 pt-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    );
  if (isUnavailable)
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          illustration="account"
          title={t("error")}
          action={
            <Button
              className="rounded-full px-6"
              onClick={() => window.location.reload()}
            >
              {t("retry")}
            </Button>
          }
        />
      </div>
    );

  const verificationKey =
    member &&
    viewer?.kind !== "anonymous" &&
    viewer?.cedulaStatus === "in_review"
      ? "verificationReview"
      : member &&
          viewer?.kind !== "anonymous" &&
          (viewer?.cedulaStatus === "matched" ||
            viewer?.cedulaStatus === "pending")
        ? "verificationDocuments"
        : "verification";

  const countBadge = (count: number) =>
    count > 0 ? (
      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-foreground px-2 font-semibold text-background text-sm tabular-nums">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="page-title">{t("title")}</h1>

      {member && viewer && viewer.kind !== "anonymous" ? (
        <div className="mt-6 flex items-center gap-4">
          {viewer.image ? (
            <span className="relative size-14 shrink-0 overflow-hidden rounded-full">
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
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground/70">
              <UserRound className="size-7" aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-xl tracking-[-0.01em]">
              {viewer.displayName}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-muted-foreground">
              {viewer.kind === "citizen" && (
                <ShieldCheck
                  className="size-4 shrink-0 text-primary"
                  aria-hidden
                />
              )}
              {viewer.kind === "citizen" ? t("verified") : t("visitor")}
            </p>
          </div>
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          illustration="account"
          title={t("anonymousTitle")}
          action={
            <Button
              className="h-11 rounded-full px-6"
              nativeButton={false}
              render={<Link href="/entrar?callbackUrl=%2Fcuenta" />}
            >
              {t("signIn")}
            </Button>
          }
        />
      )}

      {member && (
        <Section title={t("activity")}>
          <li>
            <AccountRow
              icon={ClipboardList}
              title={t("contributions")}
              href="/aportes"
            />
          </li>
          <li>
            <AccountRow icon={Stamp} title={t("passport")} href="/pasaporte" />
          </li>
          <li id="guardados" className="scroll-mt-24">
            <AccountRow
              icon={Bookmark}
              title={t("saved")}
              onClick={() => openPanel("guardados")}
              aside={countBadge(savedCount)}
            />
          </li>
          <li id="avisos" className="scroll-mt-24">
            <AccountRow
              icon={Bell}
              title={notificationsT("title")}
              onClick={() => openPanel("avisos")}
              aside={countBadge(unread)}
            />
          </li>
        </Section>
      )}

      {member &&
        ((push.state !== "unknown" && push.state !== "unsupported") ||
          (passkeySupport === "available" && passkeys.isSuccess)) && (
          <Section title={t("device")}>
            {/* Per device, which is why these sit together: both are things
                this browser can do that the account alone cannot, and both are
                meaningless on somebody else's phone. */}
            {push.state !== "unknown" && push.state !== "unsupported" && (
              <li>
                <AccountRow
                  icon={push.state === "on" ? BellRing : Bell}
                  title={t("push")}
                  hint={
                    push.state === "denied"
                      ? t("pushDeniedHint")
                      : push.state === "on"
                        ? t("pushOnShort")
                        : t("pushShort")
                  }
                  control={
                    push.state !== "denied" && (
                      <Button
                        variant={push.state === "on" ? "outline" : "default"}
                        className="h-11 rounded-full px-5"
                        disabled={push.pending}
                        onClick={() =>
                          void (push.state === "on"
                            ? push.disable()
                            : push.enable())
                        }
                      >
                        {push.pending
                          ? t("pushWorking")
                          : push.state === "on"
                            ? t("pushOff")
                            : t("pushOn")}
                      </Button>
                    )
                  }
                />
              </li>
            )}
            {/* Nothing at all until the list has answered: offering to set up
                something already set up is worse than a moment without it. */}
            {passkeySupport === "available" && passkeys.isSuccess && (
              <li>
                <AccountRow
                  icon={Fingerprint}
                  title={t("passkey")}
                  hint={hasPasskey ? t("passkeyActive") : t("passkeyShort")}
                  control={
                    !hasPasskey && (
                      <Button
                        variant="outline"
                        className="h-11 rounded-full px-5"
                        disabled={isRegistering}
                        onClick={addPasskey}
                      >
                        {isRegistering
                          ? shellT("passkeyAdding")
                          : shellT("addPasskey")}
                      </Button>
                    )
                  }
                />
              </li>
            )}
          </Section>
        )}

      <Section title={t("more")}>
        {member && viewer?.kind === "visitor" && (
          <li>
            <AccountRow
              icon={Fingerprint}
              title={t(verificationKey)}
              href="/verificar"
            />
          </li>
        )}
        {member &&
          viewer?.kind !== "anonymous" &&
          viewer?.staffRole !== "none" && (
            <li>
              <AccountRow
                icon={ShieldCheck}
                title={t("moderation")}
                href="/moderacion"
              />
            </li>
          )}
        <li>
          <AccountRow icon={Smartphone} title={t("install")} href="/instalar" />
        </li>
        <li>
          <AccountRow
            icon={ShieldCheck}
            title={t("privacy")}
            href="/privacidad"
          />
        </li>
        {member && (
          <li>
            <button
              type="button"
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
              className="-mx-2 flex min-h-[72px] w-[calc(100%+1rem)] items-center gap-4 rounded-xl px-2 py-3 text-left font-semibold text-[17px] text-red-800 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            >
              <LogOut className="size-[22px] shrink-0" aria-hidden />
              {t("signOut")}
            </button>
          </li>
        )}
      </Section>
      {error && (
        <p role="alert" className="mt-4 text-destructive text-sm">
          {t("error")}
        </p>
      )}

      {/* The panels the rows above open. Their own triggers stay hidden: the
          row is the trigger, and a second button for the same thing would be a
          second tab stop that says less. */}
      {member && (
        <>
          <NotificationBell
            className="hidden"
            open={panel === "avisos"}
            onOpenChange={(next) => {
              if (next) setPanel("avisos");
              else closePanel();
            }}
          />
          <SavedPlaces
            className="hidden"
            open={panel === "guardados"}
            onOpenChange={(next) => {
              if (next) setPanel("guardados");
              else closePanel();
            }}
          />
        </>
      )}
    </div>
  );
}
