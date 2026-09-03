"use client";

import { useEffect, useState } from "react";

export type PasskeySupport =
  /** Not yet determined — the check is asynchronous. */
  | "unknown"
  /** The browser has no WebAuthn at all. */
  | "unsupported"
  /** WebAuthn exists, but this device has no fingerprint or face unlock. */
  | "no-authenticator"
  | "available";

/**
 * Whether offering a passkey makes sense on this device.
 *
 * Showing a fingerprint button to someone whose phone has no fingerprint reader
 * is a dead end: they tap it, a dialog fails, and they are left guessing. The
 * check is cheap and the answer decides whether the option appears at all.
 *
 * Runs after mount because the server has no `navigator`, and reads
 * `isUserVerifyingPlatformAuthenticatorAvailable`, which is the only reliable
 * signal a device can actually complete the ceremony.
 */
export function usePasskeySupport(): PasskeySupport {
  const [support, setSupport] = useState<PasskeySupport>("unknown");

  useEffect(() => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setSupport("unsupported");
      return;
    }

    let cancelled = false;

    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then((available) => {
        if (!cancelled)
          setSupport(available ? "available" : "no-authenticator");
      })
      .catch(() => {
        if (!cancelled) setSupport("no-authenticator");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return support;
}
