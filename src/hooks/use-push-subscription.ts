"use client";

import { useCallback, useEffect, useState } from "react";
import { publicEnv } from "@/lib/env.public";
import { client } from "@/lib/orpc";

/**
 * Turning browser push on for this device.
 *
 * The server has been able to *send* push since the notification centre was
 * built — `sendPushToUser` signs with the VAPID keypair and posts to whatever
 * endpoints are registered. What was missing was any way to register one, so
 * the keys could be configured and the feature could never switch on. This is
 * the other half.
 *
 * Per device, not per account. A subscription belongs to one browser on one
 * machine, which is why the state here is read from the service worker rather
 * than from the session: signing in on a second phone genuinely has not
 * subscribed that phone.
 *
 * Every failure is a state rather than a throw. Push is refused, unsupported or
 * simply unconfigured far more often than it breaks — a browser with no VAPID
 * key, a laptop in a private window, somebody who said no once — and each of
 * those is a thing to render, not an error to raise.
 */
export type PushState =
  /** The check has not finished; the browser is asked after mount. */
  | "unknown"
  /** No service worker, no PushManager, or no VAPID key configured. */
  | "unsupported"
  /** Available, and this device has not subscribed. */
  | "off"
  | "on"
  /** The person refused at the browser prompt; only they can undo that. */
  | "denied";

/**
 * VAPID keys travel as base64url and `applicationServerKey` wants bytes.
 *
 * Written out rather than pulled from a library: it is eight lines, and a
 * dependency for eight lines of base64 is a dependency to keep updated.
 */
function decodeVapidKey(key: string): Uint8Array<ArrayBuffer> {
  const padded = key.padEnd(key.length + ((4 - (key.length % 4)) % 4), "=");
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));

  // Backed by a real `ArrayBuffer` rather than the default `ArrayBufferLike`:
  // `applicationServerKey` wants a `BufferSource`, and a view that might sit on
  // a `SharedArrayBuffer` is not one.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Inlined at build time, so it is a constant rather than a dependency. */
const PUBLIC_KEY = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function usePushSubscription() {
  const [state, setState] = useState<PushState>("unknown");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !PUBLIC_KEY
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }

      // `ready` rather than `getRegistration`: the worker may still be
      // installing on a first visit, and a subscription needs it active.
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!cancelled) setState(existing ? "on" : "off");
    }

    void read().catch(() => {
      if (!cancelled) setState("unsupported");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!PUBLIC_KEY) return;
    setPending(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Push without a visible notification is what gets an origin's push
        // permission revoked by the browser, so it is never used here.
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(PUBLIC_KEY),
      });

      const json = subscription.toJSON();
      const { enabled } = await client.notifications.subscribePush({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 500),
      });

      // The server says no when it has no keypair of its own. Leaving a
      // subscription the server cannot sign for would be a device quietly
      // registered for notifications that never arrive.
      if (!enabled) {
        await subscription.unsubscribe();
        setState("unsupported");
        return;
      }

      setState("on");
    } catch {
      setState("off");
    } finally {
      setPending(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setPending(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setState("off");
        return;
      }

      // The server first: a device that has unsubscribed locally but is still
      // in the table is an endpoint every future send has to fail against.
      await client.notifications.unsubscribePush({
        endpoint: subscription.endpoint,
      });
      await subscription.unsubscribe();
      setState("off");
    } catch {
      // Left as it was: a failed removal is better reported as still-on than
      // as off, which would invite a second attempt that changes nothing.
    } finally {
      setPending(false);
    }
  }, []);

  return { state, pending, enable, disable };
}
