/**
 * The procedures the queue may replay.
 *
 * An allow-list rather than "whatever the row says": a tampered IndexedDB row
 * must not be able to call anything else. Kept apart from `send.ts` because the
 * service worker reads it too, and that file's Zod contracts would cost the
 * worker half a megabyte it has no use for — the server validates every input
 * on arrival regardless.
 */
export const QUEUE_PROCEDURES = [
  "places.submit",
  "places.report",
  "traffic.report",
] as const;

export type QueueProcedure = (typeof QUEUE_PROCEDURES)[number];

export function isQueueProcedure(value: string): value is QueueProcedure {
  return (QUEUE_PROCEDURES as readonly string[]).includes(value);
}
