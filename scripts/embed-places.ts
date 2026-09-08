/**
 * Filling in the vectors.
 *
 * Runs over every published place that has no embedding yet and writes one.
 * Idempotent by construction — it only ever touches rows where the column is
 * null — so it is safe to run on a cron, after a seed, or by hand when the
 * search starts feeling literal.
 *
 *   bun run scripts/embed-places.ts          only what is missing
 *   bun run scripts/embed-places.ts --all    everything, after a model change
 */
import { eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, municipalities, places } from "@/db/schema";
import { embedPassages, placeDocument } from "@/lib/ai/embeddings";

const all = process.argv.includes("--all");
/** Small enough to keep memory flat on a 1 GB VPS, large enough to be quick. */
const BATCH = 16;

const rows = await db
  .select({
    id: places.id,
    name: places.name,
    description: places.description,
    address: places.address,
    categoryName: categories.name,
    municipalityName: municipalities.name,
  })
  .from(places)
  .innerJoin(categories, eq(categories.id, places.categoryId))
  .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
  .where(all ? eq(places.status, "published") : isNull(places.embedding));

if (rows.length === 0) {
  console.info("nothing to embed");
  process.exit(0);
}

console.info(`embedding ${rows.length} place(s)…`);

for (let index = 0; index < rows.length; index += BATCH) {
  const batch = rows.slice(index, index + BATCH);
  const vectors = await embedPassages(batch.map(placeDocument));

  // Sequential inside the transaction: a transaction owns one connection, and
  // pg deprecates issuing queries on a busy one — running them in parallel does
  // not overlap the round trips anyway.
  await db.transaction(async (tx) => {
    for (const [offset, row] of batch.entries()) {
      const vector = vectors[offset];
      if (!vector) continue;
      await tx
        .update(places)
        .set({ embedding: vector })
        .where(eq(places.id, row.id));
    }
  });

  console.info(`  ${Math.min(index + BATCH, rows.length)}/${rows.length}`);
}

const [remaining] = await db
  .select({ value: sql<number>`count(*)::int` })
  .from(places)
  .where(isNull(places.embedding));

console.info(`done. ${remaining?.value ?? 0} place(s) still without a vector.`);
process.exit(0);
