"use client";

import { Check, Crosshair, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

/**
 * The two things a map should let you do that this one could not.
 *
 * Centre on me, and send someone this exact view. Both sit above the zoom
 * controls in the bottom-right corner, which is where a hand already is on a
 * phone and where every map application puts them.
 */
function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-11 items-center justify-center rounded-full border bg-background text-foreground shadow-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

export function MapActions({
  onLocate,
}: {
  onLocate: (position: { lng: number; lat: number }) => void;
}) {
  const t = useTranslations("map.actions");
  const [locating, setLocating] = useState(false);
  const [shared, setShared] = useState(false);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onLocate({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        });
      },
      () => {
        // A refused or unavailable location is not an error worth a dialog:
        // the person either declined on purpose or is somewhere with no fix,
        // and both are ordinary here.
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function share() {
    // The whole view is in the address bar, so sharing is sharing the URL.
    const url = window.location.href;

    if (navigator.share) {
      await navigator.share({ url }).catch(() => {});
      return;
    }

    await navigator.clipboard.writeText(url).catch(() => {});
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  return (
    <div className="absolute right-4 bottom-28 z-20 flex flex-col gap-2">
      <ActionButton label={t("share")} onClick={() => void share()}>
        {shared ? (
          <Check className="size-5" aria-hidden />
        ) : (
          <Share2 className="size-5" aria-hidden />
        )}
      </ActionButton>

      <ActionButton label={t("locate")} onClick={locate}>
        {locating ? (
          <Spinner className="size-5" />
        ) : (
          <Crosshair className="size-5" aria-hidden />
        )}
      </ActionButton>
    </div>
  );
}
