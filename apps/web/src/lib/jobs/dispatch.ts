/** Every dispatch is durable, even when pg-boss is unavailable. */
import { db } from "@/db";
import { env } from "@/lib/env";
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
    } catch {
      console.error("inline job failed; durable outbox retained it");
    }
  }
  return "queued";
}
