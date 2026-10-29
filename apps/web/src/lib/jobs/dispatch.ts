/** Every dispatch is durable, even when pg-boss is unavailable. */
import { db } from "@/db";
import { env } from "@/lib/env";
import { errorDetails, logError } from "@/lib/log";
import { drainOutbox, enqueueJob } from "./outbox";
import type { JobPayloads, QueueName } from "./queues";

export async function dispatch<Q extends QueueName>(
  queue: Q,
  data: JobPayloads[Q],
  _options?: { singletonKey?: string; singletonSeconds?: number },
): Promise<"queued" | "inline" | "failed"> {
  await db.transaction((tx) => enqueueJob(tx, queue, data));
  if (!env.JOBS_ENABLED) {
    try {
      await drainOutbox();
      return "inline";
    } catch (error) {
      logError("jobs.inline_failed", errorDetails(error));
    }
  }
  return "queued";
}
