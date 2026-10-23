"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  ChartColumn,
  ChevronRight,
  Download,
  Fingerprint,
  Inbox,
  LogOut,
  type LucideIcon,
  Shield,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type ReactNode, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Avatar } from "@/components/shell/account-menu";
import { Button, ButtonLink } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/loading";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/lib/orpc";

export function AccountScreen() {
  const t = useTranslations("accountPage");
  const { viewer, isSignedIn, isLoading, isStaff } = useAuth();

  if (isLoading) return <Placeholder className="h-96" />;
  if (!isSignedIn || !viewer) {
    return (
      <div className="rounded-panel bg-card p-8 text-center shadow-ring">
        <p className="t-h3">{t("signedOutTitle")}</p>
        <p className="t-body mx-auto mt-2 max-w-[44ch] text-ink-2">
          {t("signedOutBody")}
        </p>
        <ButtonLink
          href="/entrar?callbackUrl=%2Fcuenta"
          variant="primary"
          className="mt-6"
        >
          {t("signIn")}
        </ButtonLink>
      </div>
    );
  }

  const name = viewer.displayName ?? viewer.verifiedFullName;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <section className="flex items-center gap-4 rounded-panel bg-card p-5 shadow-ring">
          <Avatar
            name={name}
            image={viewer.image}
            className="size-14 text-[17px]"
          />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-medium tracking-[-0.012em]">
              {name ?? t("noName")}
            </p>
            <p className="t-small mt-0.5 flex items-center gap-1.5 text-ink-2">
              {viewer.kind === "citizen" ? (
                <>
                  <BadgeCheck
                    strokeWidth={1.75}
                    className="size-4 text-accent"
                  />
                  {t("citizen")}
                </>
              ) : (
                t("visitor")
              )}
              {viewer.staffRole !== "none"
                ? ` · ${t(`roles.${viewer.staffRole}`)}`
                : null}
            </p>
          </div>
        </section>

        <Verification />

        <Group title={t("yours")}>
          <Row
            icon={Stamp}
            href="/pasaporte"
            title={t("passport")}
            body={t("passportHint")}
          />
          <Row
            icon={Inbox}
            href="/aportes"
            title={t("contributions")}
            body={t("contributionsHint")}
          />
          <Row
            icon={Bookmark}
            href="/explorar?ver=guardados"
            title={t("saved")}
            body={t("savedHint")}
          />
        </Group>

        {isStaff ? (
          <Group title={t("staff")}>
            <Row
              icon={ShieldCheck}
              href="/moderacion"
              title={t("moderation")}
              body={t("moderationHint")}
            />
            <Row
              icon={ChartColumn}
              href="/informes"
              title={t("reports")}
              body={t("reportsHint")}
            />
          </Group>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        <Notifications />
        <Security />
        <Appearance />
        <Group title={t("app")}>
          <Row
            icon={Download}
            href="/instalar"
            title={t("install")}
            body={t("installHint")}
          />
          <Row
            icon={Shield}
            href="/privacidad"
            title={t("privacy")}
            body={t("privacyHint")}
          />
        </Group>
        <SignOut />
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="t-label mb-2.5 text-ink-3">{title}</h2>
      <div className="divide-y divide-line/60 overflow-hidden rounded-card bg-card shadow-ring">
        {children}
      </div>
    </section>
  );
}

function Row({
  icon: Icon,
  href,
  title,
  body,
}: {
  icon: LucideIcon;
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href as "/cuenta"}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper-2"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2">
        <Icon strokeWidth={1.5} className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-ink">{title}</span>
        <span className="t-small block text-ink-3">{body}</span>
      </span>
      <ChevronRight strokeWidth={1.5} className="size-4 text-ink-4" />
    </Link>
  );
}

function Verification() {
  const t = useTranslations("accountPage.verification");
  const { viewer } = useAuth();
  const status = useQuery({
    ...orpc.identity.status.queryOptions(),
    enabled: viewer?.kind === "visitor",
  });

  if (viewer?.kind === "citizen") {
    return (
      <section className="rounded-panel bg-accent-soft p-5">
        <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <BadgeCheck strokeWidth={1.75} className="size-5 text-accent" />
          {t("verifiedTitle")}
        </p>
        <p className="t-small mt-1 text-ink-2">{t("verifiedBody")}</p>
      </section>
    );
  }

  const stage = status.data?.stage ?? "cedula";
  return (
    <section className="rounded-panel bg-paper-2 p-5">
      <p className="text-[15px] font-medium text-ink">{t(`${stage}.title`)}</p>
      <p className="t-small mt-1 text-ink-2">{t(`${stage}.body`)}</p>
      {stage !== "verified" ? (
        <ButtonLink
          href="/verificar?next=%2Fcuenta"
          variant="primary"
          size="sm"
          className="mt-4"
        >
          {t(`${stage}.action`)}
        </ButtonLink>
      ) : null}
    </section>
  );
}

function Notifications() {
  const t = useTranslations("accountPage.notifications");
  const push = usePushSubscription();
  return (
    <Group title={t("title")}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2">
          <Bell strokeWidth={1.5} className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-ink">{t("push")}</span>
          <span className="t-small block text-ink-3">
            {t(`states.${push.state}`)}
          </span>
        </span>
        {push.state === "on" || push.state === "off" ? (
          <Switch
            aria-label={t("push")}
            checked={push.state === "on"}
            disabled={push.pending}
            onCheckedChange={(checked) =>
              void (checked ? push.enable() : push.disable())
            }
          />
        ) : null}
      </div>
    </Group>
  );
}

function Security() {
  const t = useTranslations("accountPage.security");
  const support = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  if (support !== "available") return null;
  return (
    <Group title={t("title")}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-2">
          <Fingerprint strokeWidth={1.5} className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-ink">{t("passkey")}</span>
          <span className="t-small block text-ink-3">{t("passkeyHint")}</span>
        </span>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await authClient.passkey.addPasskey();
            setBusy(false);
            if (result?.error) toast.error({ title: t("failed") });
            else toast.success({ title: t("added") });
          }}
        >
          {t("add")}
        </Button>
      </div>
    </Group>
  );
}

function Appearance() {
  const t = useTranslations("map.layers");
  const tPage = useTranslations("accountPage");
  const { theme, setTheme } = useTheme();
  return (
    <section>
      <h2 className="t-label mb-2.5 text-ink-3">{tPage("appearance")}</h2>
      <Segmented
        label={tPage("appearance")}
        value={(theme as "system" | "light" | "dark") ?? "light"}
        onChange={setTheme}
        className="w-full"
        options={[
          { value: "light", label: t("light") },
          { value: "dark", label: t("dark") },
          { value: "system", label: t("system") },
        ]}
      />
    </section>
  );
}

function SignOut() {
  const t = useTranslations("accountPage");
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <Button
      variant="danger"
      className="self-start"
      onClick={async () => {
        await authClient.signOut();
        queryClient.clear();
        router.push("/");
      }}
    >
      <LogOut strokeWidth={1.5} />
      {t("signOut")}
    </Button>
  );
}
