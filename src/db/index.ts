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

// `snake_case` matches drizzle.config.ts, so table definitions can use
// camelCase property names without repeating the column name in every call.
export const db = drizzle(pool, { schema, casing: "snake_case" });
export { pool, schema };
export type Db = typeof db;
