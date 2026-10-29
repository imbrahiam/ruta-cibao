import { connection } from "next/server";

/**
 * Liveness, for the container healthcheck and an uptime monitor.
 *
 * Deliberately checks nothing: a process that can answer this is alive, and
 * anything deeper belongs to `/api/ready`. Making this depend on Postgres or
 * storage would turn a provider outage into a restart loop.
 */
export async function GET() {
  await connection();
  return Response.json(
    { status: "ok" },
    { headers: { "cache-control": "no-store" } },
  );
}
