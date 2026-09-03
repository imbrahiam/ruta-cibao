"use client";

import { BadgeCheck, Fingerprint, IdCard, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePasskeySupport } from "@/hooks/use-passkey-support";
import { Link } from "@/i18n/navigation";
import { authClient, signOut } from "@/lib/auth-client";

export type ViewerSummary = {
  kind: "visitor" | "citizen";
  displayName: string;
  cedulaStatus: string | null;
};

/** First letters of the name, for people with no photo — which is everyone. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function UserMenu({ viewer }: { viewer: ViewerSummary }) {
  const t = useTranslations("shell");
  const router = useRouter();
  const passkeySupport = usePasskeySupport();
  const [isRegistering, startRegistering] = useTransition();
  const [hasRegistered, setHasRegistered] = useState(false);

  /**
   * Makes good on what the sign-in screen promises.
   *
   * Someone who tried the fingerprint button before having an account is told
   * to sign in by email and enable it here afterwards — so "here" has to exist.
   * Offered only where the device can complete the ceremony.
   */
  function addPasskey() {
    startRegistering(async () => {
      const { error } = await authClient.passkey.addPasskey({
        authenticatorAttachment: "platform",
      });

      if (error) {
        toast.error(t("passkeyFailed"));
        return;
      }

      setHasRegistered(true);
      toast.success(t("passkeyAdded"));
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-full"
            aria-label={t("account")}
          >
            <Avatar className="size-9">
              <AvatarFallback className="text-xs">
                {initials(viewer.displayName)}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-64">
        {/* Base UI requires a group around a group label — unlike Radix,
            where the label stands alone. Without it the menu throws
            "MenuGroupContext is missing" at render. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="font-medium text-sm">{viewer.displayName}</span>
            <span className="flex items-center gap-1.5 font-normal text-muted-foreground text-xs">
              {viewer.kind === "citizen" ? (
                <>
                  <BadgeCheck
                    className="size-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  {t("resident")}
                </>
              ) : (
                <>
                  <User className="size-3.5" aria-hidden />
                  {t("visitor")}
                </>
              )}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* The one action a visitor most likely wants, surfaced rather than
            buried in a settings page they would have to go looking for. */}
        {/* `nativeButton={false}` because the render prop produces an <a>:
            Base UI must be told not to assume button semantics it will not get. */}
        {viewer.kind === "visitor" && (
          <DropdownMenuItem
            nativeButton={false}
            render={<Link href="/verificar" />}
          >
            <IdCard className="size-4" aria-hidden />
            {t("becomeResident")}
          </DropdownMenuItem>
        )}

        {passkeySupport === "available" && !hasRegistered && (
          <DropdownMenuItem
            closeOnClick={false}
            disabled={isRegistering}
            onClick={addPasskey}
          >
            <Fingerprint className="size-4" aria-hidden />
            {isRegistering ? t("passkeyAdding") : t("addPasskey")}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            router.refresh();
          }}
        >
          <LogOut className="size-4" aria-hidden />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
