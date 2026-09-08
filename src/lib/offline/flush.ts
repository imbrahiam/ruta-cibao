"use client";

import { client } from "@/lib/orpc";
import { requestBackgroundSync } from "./background-sync";
import { drainQueue, type FlushResult } from "./drain";
import { sendQueuedMutation } from "./send";

export { drainQueue, type FlushResult } from "./drain";

let activeFlush: Promise<FlushResult> | undefined;

/**
 * The page's flush: one at a time, one across tabs.
 *
 * `navigator.locks` keeps two open tabs from sending the same draft twice
 * within the window between the request leaving and the row being deleted. The
 * idempotency key would make the second one harmless, but a duplicate request
 * still costs a rural phone's data.
 *
 * A connection failure hands the rest to Background Sync, so the drafts go out
 * when signal returns even if this page is closed by then.
 */
export function flushQueue(userId: string): Promise<FlushResult> {
  if (activeFlush) return activeFlush;
  const drain = async () => {
    const result = await drainQueue(userId, (item, owner) =>
      sendQueuedMutation(client, item, owner),
    );
    if (result.failed > 0) void requestBackgroundSync();
    return result;
  };
  activeFlush = (async () => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return await navigator.locks.request("ruta-cibao-offline-flush", drain);
    }
    return drain();
  })().finally(() => {
    activeFlush = undefined;
  });
  return activeFlush;
}
