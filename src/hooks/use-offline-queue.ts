"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { flushQueue } from "@/lib/offline/flush";
import { offlineDb } from "@/lib/offline/queue";

export function useOfflineQueue() {
  const { viewer } = useAuth();
  const userId = viewer?.userId;
  const [isFlushing, setIsFlushing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [hasError, setHasError] = useState(false);
  const pending = useLiveQuery(
    () =>
      userId
        ? offlineDb().queue.where("userId").equals(userId).count()
        : Promise.resolve(0),
    [userId],
    0,
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

  return { pending: pending ?? 0, isFlushing, isOnline, hasError, flush };
}
