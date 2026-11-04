/**
 * The background worker.
 *
 * Its own process, and its own container in the compose file. Two reasons, and
 * neither is throughput: a weekly PDF render holds a headless browser for tens
 * of seconds, which has no business inside a process serving map tiles; and the
 * app can be scaled to several instances without three of them racing the same
 * cron.
 *
 * This process owns the queue schema — it is the only one that migrates, cron
 * runs here, and the schedules are declared rather than configured, so what
 * runs when is in the repository instead of in somebody's crontab.
 *
 * Every handler is idempotent, because pg-boss retries and a restart mid-job is
 * ordinary. The schedules are re-registered on every boot: `schedule()` upserts
 * by queue name, so changing a cron expression here is the whole deployment
 * step.
 *
 *   bun run worker
 */

import { db } from "@/db";
import { workerHeartbeats } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { getBoss } from "@/lib/jobs/boss";
import { handlers } from "@/lib/jobs/handlers";
import { drainOutbox } from "@/lib/jobs/outbox";
import {
  type JobPayloads,
  QUEUES,
  type QueueName,
  SCHEDULE_TIMEZONE,
  SCHEDULES,
} from "@/lib/jobs/queues";

/**
 * One job at a time per queue.
 *
 * This is a province of three municipalities, not a job farm. Serial execution
 * makes every failure reproducible and keeps the notification fan-out from
 * opening thirty connections to push at once — and if that ever becomes the
 * bottleneck, it is one option object away from not being.
 */
const WORK_OPTIONS = { batchSize: 1 } as const;

async function main() {
  const env = serverEnv();

  if (!env.JOBS_ENABLED) {
    console.error(
      "JOBS_ENABLED is 0. The worker has nothing to do; jobs run in-process instead.",
    );
    process.exit(1);
  }

  const boss = await getBoss("worker");
  if (!boss) {
    console.error("could not start the queue; see the warning above");
    process.exit(1);
  }

  boss.on("error", (error) => console.error("pg-boss error", error));

  for (const name of Object.values(QUEUES)) {
    const queue = name as QueueName;

    await boss.work(queue, WORK_OPTIONS, async (jobs) => {
      // pg-boss v12 hands the handler a batch even when the batch is one.
      for (const job of jobs) {
        const started = Date.now();
        const result = await handlers[queue](job.data as JobPayloads[never]);

        console.info("job finished", {
          queue,
          id: job.id,
          ms: Date.now() - started,
          result,
        });
      }
    });
  }

  for (const schedule of SCHEDULES) {
    await boss.schedule(schedule.queue, schedule.cron, undefined, {
      tz: SCHEDULE_TIMEZONE,
      // Collapses a backlog: a worker that was down for six hours should run
      // the expiry sweep once on the way back up, not thirty-six times.
      singletonKey: schedule.queue,
      singletonSeconds: 60,
    });
  }

  // Declared, not configured: a schedule removed from the code (such as the
  // retired civil-registry retry) is removed from pg-boss too.
  const declared = new Set<string>(SCHEDULES.map((schedule) => schedule.queue));
  for (const existing of await boss.getSchedules()) {
    if (!declared.has(existing.name)) await boss.unschedule(existing.name);
  }

  console.info("worker ready", {
    queues: Object.values(QUEUES),
    schedules: SCHEDULES.map(
      (schedule) => `${schedule.queue} @ ${schedule.cron}`,
    ),
    timezone: SCHEDULE_TIMEZONE,
  });

  let draining = false;
  const tick = async () => {
    if (draining) return;
    draining = true;
    try {
      await db
        .insert(workerHeartbeats)
        .values({ id: "worker", updatedAt: new Date() })
        .onConflictDoUpdate({
          target: workerHeartbeats.id,
          set: { updatedAt: new Date() },
        });
      await drainOutbox();
    } catch (error) {
      console.error("outbox processing failed; pending jobs will retry", error);
    } finally {
      draining = false;
    }
  };
  await tick();
  const outboxTimer = setInterval(() => void tick(), 5_000);

  // A container gets SIGTERM on deploy. Stopping gracefully lets a job that is
  // halfway through finish rather than being retried from the start.
  const stop = async (signal: string) => {
    console.info(`worker stopping on ${signal}`);
    clearInterval(outboxTimer);
    while (draining) await new Promise((resolve) => setTimeout(resolve, 100));
    await boss.stop({ graceful: true, timeout: 30_000 });
    process.exit(0);
  };

  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
}

main().catch((error: unknown) => {
  console.error("worker failed to start", error);
  process.exit(1);
});
