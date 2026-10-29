import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { type DbTransaction, db } from "@/db";
import { jobOutbox } from "@/db/schema";
import { errorDetails, logError } from "@/lib/log";
import { type JobPayloads, QUEUES, type QueueName } from "./queues";

/** Write with the domain transaction; rollback removes the job as well. */
export async function enqueueJob<Q extends QueueName>(
  tx: DbTransaction,
  queue: Q,
  data: JobPayloads[Q],
): Promise<void> {
  await tx
    .insert(jobOutbox)
    .values({ queue, data: data as Record<string, unknown> });
}

/** At-least-once execution: concurrent workers claim separate rows. */
export async function drainOutbox(limit = 20): Promise<number> {
  let processed = 0;
  for (let index = 0; index < limit; index++) {
    let claimed: { id: string; attempts: number } | undefined;
    try {
      const found = await db.transaction(async (tx) => {
        const [job] = await tx
          .select()
          .from(jobOutbox)
          .where(
            and(
              isNull(jobOutbox.processedAt),
              lte(jobOutbox.nextAttemptAt, new Date()),
            ),
          )
          .orderBy(asc(jobOutbox.createdAt))
          .limit(1)
          .for("update", { skipLocked: true });
        if (!job) return false;
        claimed = job;
        if (!Object.values(QUEUES).includes(job.queue as QueueName))
          throw new Error("Unknown outbox queue");
        const { runJob } = await import("./handlers");
        await runJob(
          job.queue as QueueName,
          job.data as JobPayloads[QueueName],
        );
        await tx
          .update(jobOutbox)
          .set({ processedAt: new Date() })
          .where(eq(jobOutbox.id, job.id));
        return true;
      });
      if (!found) break;
      processed++;
    } catch (error) {
      if (!claimed) throw new Error("Could not claim an outbox job");
      const backoffMs = Math.min(
        3_600_000,
        5_000 * 2 ** Math.min(claimed.attempts, 10),
      );
      await db
        .update(jobOutbox)
        .set({
          attempts: claimed.attempts + 1,
          nextAttemptAt: new Date(Date.now() + backoffMs),
        })
        .where(eq(jobOutbox.id, claimed.id));
      logError("outbox.job_failed", {
        jobId: claimed.id,
        attempts: claimed.attempts + 1,
        ...errorDetails(error),
      });
    }
  }
  return processed;
}
