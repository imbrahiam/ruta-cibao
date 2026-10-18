"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { flushQueue } from "@/lib/offline/flush";
import { offlineDb, type QueuedMutation } from "@/lib/offline/queue";

/**
 * What this device is still holding for the signed-in person, and a way to
 * send it. Sends again by itself whenever the browser says it is back online.
 */
export function useOfflineQueue() {
  const { viewer } = useAuth();
  const userId = viewer?.userId ?? undefined;
  const [isFlushing, setIsFlushing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [hasError, setHasError] = useState(false);
  const items = useLiveQuery<QueuedMutation[], QueuedMutation[]>(
    () =>
      userId
        ? offlineDb().queue.where("userId").equals(userId).sortBy("createdAt")
        : Promise.resolve([]),
    [userId],
    [],
  );

  const flush = useCallback(async () => {
    if (!userId) return;
    setIsFlushing(true);
    setHasError(false);
    try {
      return await flushQueue(userId);
    } catch {
      setHasError(true);
    } finally {
      setIsFlushing(false);
    }
  }, [userId]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const online = () => {
      setIsOnline(true);
      void flush();
    };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    if (navigator.onLine) void flush();
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [flush]);

  return {
    items: items ?? [],
    pending: items?.length ?? 0,
    isFlushing,
    isOnline,
    hasError,
    flush,
  };
}
