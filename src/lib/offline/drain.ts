import { ORPCError } from "@orpc/client";
import {
  forget,
  listPending,
  type QueuedMutation,
  recordFailure,
} from "./queue";

export type FlushResult = { sent: number; failed: number; blocked: number };

export type Sender = (item: QueuedMutation, userId: string) => Promise<void>;

/**
 * Answers that will not change by trying again.
 *
 * A network failure or a server error is retried; these are the server saying
 * the draft itself is wrong, and the person has to look at it. Not
 * `UNAUTHORIZED`: that is what a mismatched `expectedUserId` returns, and it
 * means somebody else is signed in on this phone right now, not that the draft
 * is bad.
 */
const PERMANENT_ERRORS = new Set([
  "BAD_REQUEST",
  "NOT_FOUND",
  "FORBIDDEN",
  "CONFLICT",
  "UNPROCESSABLE_CONTENT",
]);

/**
 * Sends everything this account has waiting, in order, and stops at the first
 * connection failure.
 *
 * A failed connection never discards a draft. Invalid drafts are marked and
 * skipped so a later, independent submission can still go out, and stay
 * visible for review under `/pendientes`.
 *
 * Shared by the page and the service worker, which is why it takes the sender
 * rather than importing a client: the two run different clients over the same
 * queue.
 */
export async function drainQueue(
  userId: string,
  send: Sender,
): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failed: 0, blocked: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return result;

  for (const item of await listPending()) {
    if (item.userId !== userId || item.blocked) continue;
    try {
      await send(item, userId);
      await forget(item.id);
      result.sent += 1;
    } catch (error) {
      const code = error instanceof ORPCError ? error.code : "NETWORK_ERROR";
      const blocked =
        PERMANENT_ERRORS.has(code) ||
        (error instanceof Error && error.name === "ZodError");
      await recordFailure(item.id, code, blocked);
      if (blocked) {
        result.blocked += 1;
        continue;
      }
      result.failed += 1;
      break;
    }
  }
  return result;
}
