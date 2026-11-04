import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit runs outside the Next.js module graph, so it reads the connection
 * string straight from the environment rather than through `@/lib/env`.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is required to run drizzle-kit. See .env.example.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  extensionsFilters: ["postgis"],
  casing: "snake_case",
  verbose: true,
  strict: true,
});
