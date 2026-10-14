"use client";

import { Download, Share, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/use-device";
import { Link } from "@/i18n/navigation";
import {
  INSTALL_MOMENT_EVENT,
  installMomentEarned,
} from "@/lib/install-moment";
import { useInstall } from "./install-provider";

/**
 * The install offer, where people actually are — once they have a reason.
 *
 * `/instalar` explains installation to somebody who went looking for it.
 * Almost nobody does: Chrome's own offer is a line in a menu, and Safari's is
 * three taps deep behind a share icon. So the app makes the offer itself.
 *
 * It used to be a full screen on the first visit to the map, before the
 * person had seen what they came for. That is the interstitial pattern
 * browsers and search engines call intrusive, and it asked for commitment at
 * the moment of least trust. Now it waits for a sign the app was useful — a
 * report sent or queued, a place saved (`markInstallMoment`) — and arrives as
 * a card over the bottom of the map that can be ignored. Nothing is blocked
 * and focus is not taken.
 *
 * It shows only on a phone or a tablet, and asks the browser what the device
 * is rather than measuring the window: a laptop with a narrow window has no
 * home screen to install onto, and a media query cannot tell the two apart.
 *
 * Once shown, not again for a month — counted from when it was *made*, not
 * when it was refused, so reloading past it spends the same one chance a
 * dismissal does. That is what makes it an offer rather than a toll.
 */
const SNOOZE_KEY = "ruta-cibao:install-snoozed-until";
const SNOOZE_DAYS = 30;
/** Long enough for the success toast to be read first. */
const DELAY_MS = 1200;

/**
 * Whether the offer is on cooldown.
 *
 * Unreadable storage — private mode, Lockdown Mode, cookies blocked — counts
 * as snoozed. Nothing here is worth throwing inside the map's own component
 * tree for, and the honest reading of a device that cannot remember being
 * asked is that it would be asked on every single load.
 */
function snoozedUntil(): boolean {
  try {
    return Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
  } catch {
    return true;
  }
}

function snooze(): void {
  try {
    window.localStorage.setItem(
      SNOOZE_KEY,
      String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000),
    );
  } catch {
    // Then it may be offered again sooner. Better than not at all.
  }
}

export function InstallSplash({
  hidden = false,
}: {
  /** While something more important is on screen, like the crosshair. */
  hidden?: boolean;
}) {
  const t = useTranslations("install");
  const device = useDevice();
  const { available, installed, pending, error, install } = useInstall();
  // Starts closed rather than open: the answer lives in storage, which the
  // server cannot read, and guessing "show it" would flash the card over the
  // map for one frame on every load that should not have had one.
  const [snoozed, setSnoozed] = useState(true);
  const [earned, setEarned] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSnoozed(snoozedUntil());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      setEarned(true);
      clearTimeout(timer);
      timer = setTimeout(() => setReady(true), DELAY_MS);
    };
    if (installMomentEarned()) arm();
    window.addEventListener(INSTALL_MOMENT_EVENT, arm);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(INSTALL_MOMENT_EVENT, arm);
    };
  }, []);

  // No `beforeinstallprompt` on iOS and there never will be, which is why the
  // card carries Safari's own instruction instead.
  const ios = device?.ios === true;
  const open =
    earned &&
    ready &&
    !hidden &&
    !snoozed &&
    !installed &&
    device?.mobile === true &&
    (available || ios);

  // The month starts here, the moment the offer is actually on screen —
  // deliberately not in the close handler, which never runs for someone who
  // reloads or navigates away instead of answering.
  useEffect(() => {
    if (open) snooze();
  }, [open]);

  if (!open) return null;

  return (
    <section
      aria-labelledby="install-offer-title"
      className="fade-in-0 slide-in-from-bottom-4 absolute inset-x-3 bottom-3 z-30 animate-in rounded-3xl border bg-background/98 p-4 pr-3 shadow-[0_18px_48px_-16px_rgb(0_0_0/0.35)] backdrop-blur-md duration-300 md:right-auto md:left-4 md:w-96"
    >
      <div className="flex items-start gap-3">
        <Image
          src="/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-[0.9rem] shadow-sm ring-1 ring-black/5"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2
            id="install-offer-title"
            className="text-pretty font-semibold text-[15px] leading-snug"
          >
            {t("bannerTitle")}
          </h2>
          <p className="mt-1 text-pretty text-muted-foreground text-sm leading-snug">
            {ios ? (
              <>
                <Share
                  className="-mt-0.5 mr-1 inline size-3.5 text-primary"
                  aria-hidden
                />
                {t("bannerIos")}
              </>
            ) : (
              t("bannerBody")
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-1 size-9 shrink-0 rounded-full text-muted-foreground"
          aria-label={t("dismiss")}
          onClick={() => setSnoozed(true)}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-destructive text-sm">
          {t("error")}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2 pr-1">
        <Button
          variant="ghost"
          className="h-10 rounded-full px-4 text-muted-foreground"
          onClick={() => setSnoozed(true)}
        >
          {t("dismiss")}
        </Button>
        {available ? (
          <Button
            className="h-10 rounded-full px-5"
            disabled={pending}
            onClick={() => void install()}
          >
            <Download className="size-4" aria-hidden />
            {t("action")}
          </Button>
        ) : (
          <Button
            className="h-10 rounded-full px-5"
            nativeButton={false}
            render={<Link href="/instalar" />}
          >
            {t("how")}
          </Button>
        )}
      </div>
    </section>
  );
}
