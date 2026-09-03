"use client";

import { Eye, Lock, ShieldCheck, Vote } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

/**
 * What actually happens to a cédula, on request.
 *
 * Asking a citizen for a national ID number is the one moment this app has to
 * earn trust, and a line of fine print under the field does not. A drawer keeps
 * the form uncluttered for people who do not care and gives a straight answer
 * to those who do, without navigating away and losing what they typed.
 *
 * Every claim here is true of the implementation: the number is encrypted with
 * `encryptSensitive`, stored alongside a keyed HMAC so it can be matched
 * without being read, and never selected into any page, log or API response.
 */
const POINTS = [
  { key: "lookup", Icon: ShieldCheck },
  { key: "encrypted", Icon: Lock },
  { key: "never_shown", Icon: Eye },
  { key: "one_vote", Icon: Vote },
] as const;

export function CedulaPrivacyDrawer() {
  const t = useTranslations("onboarding.cedula.privacy");

  return (
    <Drawer>
      <DrawerTrigger
        render={
          <button
            type="button"
            className="text-left font-medium text-xs underline underline-offset-4 hover:text-foreground"
          >
            {t("trigger")}
          </button>
        }
      />

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("title")}</DrawerTitle>
          <DrawerDescription>{t("subtitle")}</DrawerDescription>
        </DrawerHeader>

        <ul className="flex flex-col gap-5 px-4 pb-10">
          {POINTS.map(({ key, Icon }) => (
            <li key={key} className="flex items-start gap-3">
              <Icon
                className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span>
                <span className="block font-medium text-sm">
                  {t(`${key}.title`)}
                </span>
                <span className="mt-0.5 block text-muted-foreground text-sm leading-relaxed">
                  {t(`${key}.body`)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
