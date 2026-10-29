"use client";

import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { cx } from "@/lib/web/cx";
import { StoreLogo } from "./store-logo";

type Platform = "ios" | "android" | "other";

function detect(): Platform {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  if (/Android/i.test(agent)) return "android";
  return "other";
}

export function StoreButtons({
  iosUrl,
  androidUrl,
  labels,
}: {
  iosUrl: string | null;
  androidUrl: string | null;
  labels: {
    ios: string;
    android: string;
    iosSoon: string;
    androidSoon: string;
  };
}) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [unavailable, setUnavailable] = useState<"ios" | "android" | null>(
    null,
  );
  useEffect(() => setPlatform(detect()), []);

  const items = [
    { key: "ios", url: iosUrl, label: labels.ios },
    {
      key: "android",
      url: androidUrl,
      label: labels.android,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {items.map(({ key, url, label }) => {
          const className = cx(
            buttonStyles({ variant: "accent", size: "lg" }),
            platform === key && "order-first",
          );
          const content = (
            <>
              <StoreLogo platform={key} />
              {label}
            </>
          );
          return url ? (
            <a key={key} href={url} rel="noopener" className={className}>
              {content}
            </a>
          ) : (
            <button
              key={key}
              type="button"
              className={className}
              onClick={() => setUnavailable(key)}
            >
              {content}
            </button>
          );
        })}
      </div>
      <p role="status" className="t-small min-h-5 text-ink-2">
        {unavailable === "ios"
          ? labels.iosSoon
          : unavailable === "android"
            ? labels.androidSoon
            : null}
      </p>
    </div>
  );
}
