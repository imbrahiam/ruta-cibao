"use client";

import { useEffect, useState } from "react";

export type Device = {
  /** A phone or a tablet — something with a home screen to install onto. */
  mobile: boolean;
  /** iOS or iPadOS, where installing is manual and `beforeinstallprompt` never fires. */
  ios: boolean;
};

type NavigatorWithHints = Navigator & {
  userAgentData?: { mobile?: boolean };
};

/**
 * What the browser says the device is — not how wide the window happens to be.
 *
 * A narrow window on a laptop is not a phone: it has no home screen, so the
 * install offer means nothing there, and a media query would show it anyway.
 * So this asks the user agent: the User-Agent Client Hints `mobile` bit where
 * Chromium exposes it, the user-agent string everywhere else.
 */
function detect(): Device {
  const ua = navigator.userAgent;
  // iPadOS reports a Macintosh user agent; the touch points are the tell.
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const hints = (navigator as NavigatorWithHints).userAgentData;
  const mobile =
    ios ||
    hints?.mobile === true ||
    // Android tablets set no `mobile` hint, and neither do the rest, but they
    // all say so in words.
    /Android|Mobile|Tablet|Silk|Kindle|BlackBerry|Opera Mini|IEMobile|Windows Phone/.test(
      ua,
    );
  return { mobile, ios };
}

/**
 * `null` until the first client render — the server cannot know the device, and
 * guessing would flash the wrong UI on whichever half of the audience it got
 * wrong.
 */
export function useDevice(): Device | null {
  const [device, setDevice] = useState<Device | null>(null);
  useEffect(() => setDevice(detect()), []);
  return device;
}
