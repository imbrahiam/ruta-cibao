"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  ChartColumn,
  Check,
  CircleUserRound,
  Inbox,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Stamp,
  Sun,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth/auth-context";
import { ButtonLink } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuLinkItem,
  MenuSeparator,
} from "@/components/ui/menu";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cx } from "@/lib/cx";

export function Avatar({
  name,
  image,
  className,
}: {
  name: string | null | undefined;
  image?: string | null;
  className?: string;
}) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cx(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-3 text-[12px] font-medium text-ink-2",
        className,
      )}
    >
      {image ? (
        // biome-ignore lint/performance/noImgElement: avatars come from the auth provider's own host
        <img src={image} alt="" className="size-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <CircleUserRound strokeWidth={1.5} className="size-[18px]" />
      )}
    </span>
  );
}

export function AccountMenu({ align = "end" }: { align?: "start" | "end" }) {
  const t = useTranslations("account.menu");
  const tNav = useTranslations("nav");
  const { viewer, isSignedIn, isStaff, isLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  if (isLoading) {
    return <span aria-hidden className="size-10 rounded-full bg-paper-3" />;
  }

  if (!isSignedIn || !viewer) {
    return (
      <ButtonLink href="/entrar" variant="primary" size="sm">
        {tNav("signIn")}
      </ButtonLink>
    );
  }

  const name = viewer.displayName ?? viewer.verifiedFullName;

  return (
    <Menu
      align={align}
      trigger={
        <button
          type="button"
          aria-label={t("open")}
          className="press flex size-10 items-center justify-center rounded-full hover:bg-paper-3 pointer-coarse:size-11"
        >
          <Avatar name={name} image={viewer.image} />
        </button>
      }
    >
      <div className="flex items-center gap-3 px-3 pt-2 pb-3">
        <Avatar name={name} image={viewer.image} className="size-10" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">
            {name ?? t("noName")}
          </p>
          <p className="t-small flex items-center gap-1 text-ink-3">
            {viewer.kind === "citizen" ? (
              <>
                <BadgeCheck
                  strokeWidth={1.75}
                  className="size-3.5 text-accent"
                />
                {t("citizen")}
              </>
            ) : (
              t("visitor")
            )}
          </p>
        </div>
      </div>
      <MenuSeparator />
      <MenuLinkItem render={<Link href="/cuenta" />}>
        <CircleUserRound strokeWidth={1.5} />
        {tNav("account")}
      </MenuLinkItem>
      <MenuLinkItem render={<Link href="/aportes" />}>
        <Inbox strokeWidth={1.5} />
        {tNav("contributions")}
      </MenuLinkItem>
      <MenuLinkItem render={<Link href="/pasaporte" />}>
        <Stamp strokeWidth={1.5} />
        {tNav("passport")}
      </MenuLinkItem>
      {isStaff ? (
        <>
          <MenuLinkItem render={<Link href="/moderacion" />}>
            <ShieldCheck strokeWidth={1.5} />
            {tNav("moderation")}
          </MenuLinkItem>
          <MenuLinkItem render={<Link href="/informes" />}>
            <ChartColumn strokeWidth={1.5} />
            {tNav("reports")}
          </MenuLinkItem>
        </>
      ) : null}
      <MenuSeparator />
      <BaseMenu.Group>
        <BaseMenu.GroupLabel className="t-label px-3 pt-2 pb-1.5 text-ink-3">
          {t("theme")}
        </BaseMenu.GroupLabel>
        <BaseMenu.RadioGroup
          value={theme ?? "system"}
          onValueChange={(value) => setTheme(String(value))}
        >
          {(
            [
              ["system", Monitor],
              ["light", Sun],
              ["dark", Moon],
            ] as const
          ).map(([value, Icon]) => (
            <BaseMenu.RadioItem
              key={value}
              value={value}
              closeOnClick={false}
              className="flex min-h-10 w-full cursor-default items-center gap-3 rounded-[10px] px-3 text-[15px] text-ink outline-none data-[highlighted]:bg-paper-2 pointer-coarse:min-h-11 [&>svg]:size-[18px] [&>svg]:text-ink-2"
            >
              <Icon strokeWidth={1.5} />
              <span className="flex-1">{t(`themes.${value}`)}</span>
              <BaseMenu.RadioItemIndicator>
                <Check strokeWidth={1.75} className="size-4 text-accent" />
              </BaseMenu.RadioItemIndicator>
            </BaseMenu.RadioItem>
          ))}
        </BaseMenu.RadioGroup>
      </BaseMenu.Group>
      <MenuSeparator />
      <MenuItem
        onClick={async () => {
          await authClient.signOut();
          await queryClient.invalidateQueries();
          router.push("/");
        }}
      >
        <LogOut strokeWidth={1.5} />
        {t("signOut")}
      </MenuItem>
    </Menu>
  );
}
