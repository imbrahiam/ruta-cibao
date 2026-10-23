"use client";

import { Apple, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { cx } from "@/lib/web/cx";

type Platform = "ios" | "android" | "other";

function detect(): Platform {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  if (/Android/i.test(agent)) return "android";
  return "other";
}

/**
 * The download actions.
 *
 * Both stores are always shown, and a phone's own store goes first. Nothing
 * redirects: a visitor can read the page, and staff on a phone can still reach
 * the administration. A store with no link yet says "Próximamente" in plain
 * text and is not a button, so there is never a fake store link.
 */
export function StoreButtons({
  iosUrl,
  androidUrl,
  labels,
  tone = "light",
}: {
  iosUrl: string | null;
  androidUrl: string | null;
  /** Already-translated text: this component renders outside any provider. */
  labels: {
    ios: string;
    android: string;
    iosSoon: string;
    androidSoon: string;
  };
  tone?: "light" | "dark";
}) {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => setPlatform(detect()), []);

  const items = [
    {
      key: "ios",
      url: iosUrl,
      Icon: Apple,
      label: labels.ios,
      soon: labels.iosSoon,
    },
    {
      key: "android",
      url: androidUrl,
      Icon: Smartphone,
      label: labels.android,
      soon: labels.androidSoon,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {items.map(({ key, url, Icon, label, soon }) => {
        const first = platform === key;
        const order = first ? "order-first" : "";
        if (!url) {
          return (
            <span
              key={key}
              className={cx(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium",
                tone === "dark"
                  ? "bg-white/10 text-on-pine"
                  : "bg-paper-3 text-ink-2",
                order,
              )}
            >
              <Icon aria-hidden className="size-[18px]" />
              {soon}
            </span>
          );
        }
        return (
          <a
            key={key}
            href={url}
            rel="noopener"
            className={cx(
              buttonStyles({
                variant: first || platform === "other" ? "accent" : "secondary",
                size: "lg",
              }),
              order,
            )}
          >
            <Icon aria-hidden />
            {label}
          </a>
        );
      })}
    </div>
  );
}
