"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Bell, Download, Share, WifiOff, X, Zap } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { DotPattern } from "@/components/ui/dot-pattern";
import { useDevice } from "@/hooks/use-device";
import { Link } from "@/i18n/navigation";
import { useInstall } from "./install-provider";

/**
 * The install offer, where people actually are.
 *
 * `/instalar` explains installation to somebody who went looking for it.
 * Almost nobody does: Chrome's own offer is a line in a menu, and Safari's is
 * three taps deep behind a share icon. So the app makes the offer itself, and
 * makes it once — a full screen that says what installing is for, rather than
 * a card in a corner that reads as an ad and gets swatted away.
 *
 * It shows only on a phone or a tablet, and asks the browser what the device
 * is rather than measuring the window: a laptop with a narrow window has no
 * home screen to install onto, and a media query cannot tell the two apart.
 *
 * Made on the first visit to the map, and then not again for a month. The
 * person who says "ahora no" at a washed-out bridge is not saying "never" —
 * but they are saying "not on the next four loads either", which is what used
 * to happen: the offer waited for the second visit and then came back on the
 * third, the fourth and every one after, because the month only started when
 * somebody dismissed it. On iOS, where there is no `beforeinstallprompt` to
 * gate it, that put a full screen between a person and the map they had opened
 * the app to read.
 *
 * So the month starts when the offer is *made*, not when it is refused.
 * Reloading past it, or leaving the page, spends the same one chance a
 * dismissal does — which is what makes it an offer rather than a toll.
 */
const SNOOZE_KEY = "ruta-cibao:install-snoozed-until";
const SNOOZE_DAYS = 30;
/** Long enough for the map to paint first: the offer is not the errand. */
const DELAY_MS = 1600;

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

const BENEFITS = [
  { key: "benefitFast", icon: Zap },
  { key: "benefitOffline", icon: WifiOff },
  { key: "benefitAlerts", icon: Bell },
] as const;

const IOS_STEPS = [
  "splashIosStep1",
  "splashIosStep2",
  "splashIosStep3",
] as const;

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
  // server cannot read, and guessing "show it" would flash the splash over the
  // map for one frame on every load that should not have had one.
  const [snoozed, setSnoozed] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSnoozed(snoozedUntil());
    const timer = setTimeout(() => setReady(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // No `beforeinstallprompt` on iOS and there never will be, which is why the
  // splash carries Safari's own instructions instead.
  const ios = device?.ios === true;
  const open =
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

  return (
    <DialogPrimitive.Root
      open={open}
      // Closing only has to close it: the cooldown was written when it opened.
      onOpenChange={(next) => {
        if (!next) setSnoozed(true);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="install-splash-overlay"
          className="fixed inset-0 z-50 bg-black/50 duration-300 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          data-slot="install-splash"
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background outline-none duration-300 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-10"
        >
          <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-primary px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-12 text-center text-primary-foreground">
            <DotPattern
              width={22}
              height={22}
              cr={1.1}
              className="text-primary-foreground/20 [mask-image:radial-gradient(70%_60%_at_50%_45%,white,transparent)]"
            />
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3 rounded-full text-primary-foreground/80 hover:bg-white/15 hover:text-primary-foreground"
                />
              }
            >
              <X className="size-5" aria-hidden />
              <span className="sr-only">{t("dismiss")}</span>
            </DialogPrimitive.Close>

            <div className="relative flex size-24 items-center justify-center overflow-hidden rounded-[1.75rem] bg-white shadow-2xl ring-1 ring-black/10">
              <Image
                src="/icon-192.png"
                alt=""
                width={96}
                height={96}
                className="size-24"
                priority
              />
              <BorderBeam
                size={70}
                duration={6}
                className="from-transparent via-white to-transparent"
              />
            </div>

            <div className="relative space-y-2">
              <p className="font-semibold text-[0.7rem] text-primary-foreground/70 tracking-[0.18em]">
                {t("splashEyebrow")}
              </p>
              <DialogPrimitive.Title className="text-balance font-semibold text-2xl leading-tight">
                {t("bannerTitle")}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-pretty text-primary-foreground/80 text-sm leading-relaxed">
                {t("bannerBody")}
              </DialogPrimitive.Description>
            </div>
          </div>

          <div className="-mt-7 relative rounded-t-[2rem] bg-background px-6 pt-7 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_34px_-16px_rgb(0_0_0/0.35)]">
            {ios ? (
              <ol className="space-y-3.5">
                {IOS_STEPS.map((key, index) => (
                  <li key={key} className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary text-sm">
                      {index + 1}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-sm leading-snug">
                      {t(key)}
                      {index === 0 && (
                        <Share className="size-4 text-primary" aria-hidden />
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="space-y-3.5">
                {BENEFITS.map(({ key, icon: Icon }) => (
                  <li key={key} className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="text-sm leading-snug">{t(key)}</span>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p role="alert" className="mt-4 text-destructive text-sm">
                {t("error")}
              </p>
            )}

            <div className="mt-6 space-y-2">
              {available ? (
                <>
                  <Button
                    className="h-12 w-full rounded-full text-base"
                    disabled={pending}
                    onClick={() => void install()}
                  >
                    <Download className="size-5" aria-hidden />
                    {t("action")}
                  </Button>
                  <DialogPrimitive.Close
                    render={
                      <Button
                        variant="ghost"
                        className="h-11 w-full rounded-full text-muted-foreground"
                      />
                    }
                  >
                    {t("dismiss")}
                  </DialogPrimitive.Close>
                </>
              ) : (
                <>
                  <DialogPrimitive.Close
                    render={
                      <Button className="h-12 w-full rounded-full text-base" />
                    }
                  >
                    {t("splashGotIt")}
                  </DialogPrimitive.Close>
                  <Button
                    variant="ghost"
                    className="h-11 w-full rounded-full text-muted-foreground"
                    nativeButton={false}
                    render={<Link href="/instalar" />}
                  >
                    {t("how")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
