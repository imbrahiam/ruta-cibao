"use client";

import { isNetworkError } from "@/lib/errors";
import type { QueueProcedure } from "./procedures";
import { enqueue, newIdempotencyKey } from "./queue";

export { newIdempotencyKey };

/**
 * Sends a queueable mutation now, or keeps it for later.
 *
 * A dead zone is exactly where a road is blocked, so a report is worth sending
 * late rather than not at all. Offline, or when the request never reaches the
 * server, the input goes to the IndexedDB queue under its idempotency key and
 * Background Sync (or the next open) sends it. A server that answered with an
 * error is not a network problem, so that error is thrown as usual.
 */
export async function sendOrQueue<T>({
  procedure,
  input,
  userId,
  idempotencyKey,
  labelKey,
  send,
}: {
  procedure: QueueProcedure;
  input: unknown;
  userId: string;
  idempotencyKey: string;
  labelKey: string;
  send: () => Promise<T>;
}): Promise<{ queued: true } | { queued: false; result: T }> {
  const keep = async () => {
    await enqueue({ procedure, input, userId, idempotencyKey, labelKey });
    return { queued: true as const };
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return keep();
  try {
    return { queued: false, result: await send() };
  } catch (error) {
    if (isNetworkError(error)) return keep();
    throw error;
  }
}
