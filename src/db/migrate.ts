/**
 * Applies pending migrations, and makes sure the extensions those migrations
 * depend on exist first.
 *
 * Safe to run repeatedly and on a fresh database: `CREATE EXTENSION IF NOT
 * EXISTS` and Drizzle's journal both no-op when the work is already done, so a
 * deploy that retries this step converges on the same state.
 */

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

const REQUIRED_EXTENSIONS = [
  "postgis",
  "vector",
  // Trigram matching, so search survives the way people actually type: without
  // accents, with a letter missing, or with the name half-remembered.
  "pg_trgm",
  // Accent-insensitive comparison. "Monción" and "moncion" are the same word to
  // everyone except a database that has not been told so.
  "unaccent",
] as const;

async function main() {
  for (const extension of REQUIRED_EXTENSIONS) {
    await db.execute(sql.raw(`CREATE EXTENSION IF NOT EXISTS ${extension}`));
    console.log(`extension ready: ${extension}`);
  }

  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("migrations applied");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
