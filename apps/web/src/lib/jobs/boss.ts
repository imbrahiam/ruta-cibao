/**
 * The queue connection.
 *
 * pg-boss keeps its jobs in the same PostgreSQL this application already runs,
 * in its own schema. That is the whole reason it was chosen over Redis-backed
 * queues: a municipality inheriting this platform has one database to back up
 * and one to restore, and a job that was queued inside a transaction cannot
 * survive that transaction rolling back.
 *
 * Two processes hold an instance and they want different things:
 *
 *   the web app   sends jobs and nothing else — no supervisor, no cron, no
 *                 migrations. It is a client.
 *   the worker    owns the schema, runs the cron, and does the work.
 *
 * `getBoss()` returns `null` rather than throwing when the queue is off or
 * unreachable. Callers fall back to running the work in-process (see
 * `dispatch`), because a broken queue must not take the request with it: a
 * citizen reporting a flooded road cares that the report lands, not that a
 * notification fan-out was deferred.
 */
import { PgBoss } from "pg-boss";
import { env } from "@/lib/env";
import { QUEUES, type QueueName } from "./queues";

type Role = "client" | "worker";

const globalForBoss = globalThis as unknown as {
  boss?: Promise<PgBoss | null>;
  bossRole?: Role;
};

function create(role: Role): PgBoss {
  return new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: env.JOBS_SCHEMA,
    application_name: `ruta-cibao-${role}`,
    // The worker is the only process allowed to change the queue schema, so a
    // rolling deploy of the web app can never race two migrations against each
    // other. A client that finds no schema simply fails to start, which is what
    // the in-process fallback is for.
    migrate: role === "worker",
    createSchema: role === "worker",
    supervise: role === "worker",
    schedule: role === "worker",
    // Small: the app sends a handful of jobs a minute at most, and every
    // connection here is one the request pool does not get.
    max: role === "worker" ? 4 : 2,
  });
}

/**
 * Starts the queue once per process, or reports that there isn't one.
 *
 * The failure is cached along with the success. Retrying the connection on
 * every send would put a database round trip in front of each request during
 * an outage, which is the opposite of degrading gracefully.
 */
export function getBoss(role: Role = "client"): Promise<PgBoss | null> {
  if (!env.JOBS_ENABLED) return Promise.resolve(null);

  // A worker asking after a client already started one needs the real thing,
  // not the send-only instance. In practice they are separate processes; this
  // only matters when a single dev process does both.
  if (globalForBoss.boss && globalForBoss.bossRole === role) {
    return globalForBoss.boss;
  }

  globalForBoss.bossRole = role;
  const started: Promise<PgBoss | null> = create(role)
    .start()
    .then(async (boss): Promise<PgBoss | null> => {
      // Queues must exist before anything is sent to them. Idempotent, so both
      // roles can ask and a restart costs nothing.
      if (role === "worker") {
        for (const name of Object.values(QUEUES)) {
          await boss.createQueue(name);
        }
      }
      return boss;
    })
    .catch((error: unknown) => {
      console.warn(
        "background queue unavailable; jobs will run in-process",
        error,
      );
      return null;
    });

  globalForBoss.boss = started;
  return started;
}

/** Queue names, re-exported so a worker file needs one import. */
export type { QueueName };
