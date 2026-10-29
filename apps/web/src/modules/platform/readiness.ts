import { sql } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/lib/env";
import { checkStorage } from "@/lib/storage";

export type Readiness = {
  status: "ok" | "degraded";
  checks: { database: boolean; storage: boolean; worker: boolean };
};

/** One mapping from a readiness answer to an HTTP answer, so both are tested. */
export function readinessResponse(result: Readiness): Response {
  return Response.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}

export async function readiness() {
  const [database, storage] = await Promise.allSettled([
    db.execute(
      sql`select to_regclass('public.member_profiles') is not null and to_regclass('public.job_outbox') is not null as ready`,
    ),
    checkStorage(),
  ]);
  const databaseReady =
    database.status === "fulfilled" && database.value.rows[0]?.ready === true;
  const storageReady = storage.status === "fulfilled";
  let workerReady = !env.JOBS_ENABLED;
  if (databaseReady && env.JOBS_ENABLED) {
    try {
      const heartbeat = await db.execute(
        sql`select exists(select 1 from worker_heartbeats where id = 'worker' and updated_at > now() - interval '2 minutes') as ready`,
      );
      workerReady = heartbeat.rows[0]?.ready === true;
    } catch {
      workerReady = false;
    }
  }
  return {
    status: databaseReady && storageReady && workerReady ? "ok" : "degraded",
    checks: {
      database: databaseReady,
      storage: storageReady,
      worker: workerReady,
    },
  } as const;
}
