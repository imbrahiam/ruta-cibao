"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { flushQueue } from "@/lib/offline/flush";
import { offlineDb } from "@/lib/offline/queue";

/**
 * Keeps the queue draining and reports what it is doing.
 *
 * Flushes on mount and whenever the browser says it is back online. `online`
 * is optimistic — it fires when an interface comes up, not when the network
 * actually works — so a failed flush simply leaves the items in place for the
 * next attempt rather than being treated as a lost cause.
 */
export function useOfflineQueue() {
  const [isFlushing, setIsFlushing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const pending = useLiveQuery(() => offlineDb().queue.count(), [], 0);

  const flush = useCallback(async () => {
    setIsFlushing(true);
    try {
      return await flushQueue();
    } finally {
      setIsFlushing(false);
    }
  }, []);

  useEffect(() => {
    // Read after mount, never during render: the server has no navigator, and
    // assuming a value would produce a hydration mismatch on the first paint.
    setIsOnline(navigator.onLine);

    const goOnline = () => {
      setIsOnline(true);
      void flush();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    if (navigator.onLine) void flush();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flush]);

  return { pending: pending ?? 0, isFlushing, isOnline, flush };
}
