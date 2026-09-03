"use client";

import { client } from "@/lib/orpc";
import { forget, listPending, recordFailure } from "./queue";

/** Attempts past which an item is treated as poison rather than retried forever. */
const MAX_ATTEMPTS = 8;

type ProcedureCall = (
  input: unknown,
  options?: { context?: Record<string, unknown> },
) => Promise<unknown>;

/**
 * Resolves `traffic.report` to the client method it names.
 *
 * The queue stores a path rather than a function because it has to survive a
 * page reload, and a function cannot be written to IndexedDB.
 */
function resolve(procedure: string): ProcedureCall | undefined {
  const found = procedure.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, client);

  return typeof found === "function" ? (found as ProcedureCall) : undefined;
}

export type FlushResult = { sent: number; failed: number; dropped: number };

/**
 * Sends everything waiting, oldest first.
 *
 * Order matters: a report and its follow-up correction have to arrive in the
 * order they were made. So one failure stops the run rather than skipping ahead
 * — the next attempt picks up where this one stopped.
 *
 * An item that has failed too many times is dropped instead of blocking the
 * queue behind it forever. That is a real loss, so it is reported rather than
 * swallowed.
 */
export async function flushQueue(): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failed: 0, dropped: 0 };

  if (typeof navigator !== "undefined" && !navigator.onLine) return result;

  for (const item of await listPending()) {
    const call = resolve(item.procedure);

    if (!call) {
      // The procedure no longer exists — an old queued item after a deploy.
      await forget(item.id);
      result.dropped += 1;
      continue;
    }

    try {
      await call(item.input, {
        context: { idempotencyKey: item.idempotencyKey },
      });
      await forget(item.id);
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";

      if (item.attempts + 1 >= MAX_ATTEMPTS) {
        await forget(item.id);
        result.dropped += 1;
        console.error(
          "dropping a queued mutation after repeated failures",
          item.procedure,
          message,
        );
        continue;
      }

      await recordFailure(item.id, message);
      result.failed += 1;
      break;
    }
  }

  return result;
}
