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

function getPool(): Pool {
  globalForDb.pool ??= new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === "production" ? 10 : 4,
    connectionTimeoutMillis: 5000,
  });
  return globalForDb.pool;
}

// Route discovery during a secret-free build must not validate runtime env.
const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const instance = getPool();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

function createDb() {
  return drizzle(getPool(), { schema, casing: "snake_case" });
}
let instance: ReturnType<typeof createDb> | undefined;
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, property) {
    instance ??= createDb();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
export { pool, schema };
export type Db = typeof db;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
