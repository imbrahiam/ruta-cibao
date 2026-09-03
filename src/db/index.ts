import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Next.js recreates modules on every hot reload in development, which would
 * open a new pool each time until Postgres refuses connections. Caching on
 * globalThis keeps a single pool across reloads; production imports once.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === "production" ? 10 : 4,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
export { pool, schema };
export type Db = typeof db;
