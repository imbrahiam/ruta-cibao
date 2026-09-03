/**
 * Seeds the reference data the app cannot start empty with.
 *
 * Idempotent: re-running updates names rather than duplicating rows, so it is
 * safe in a deploy step and safe to run again after a demo reset.
 *
 * Boundaries are left null here. They come from official shapefiles and are
 * loaded separately; the app degrades to municipality-by-selection until then,
 * rather than pretending to know where the borders are.
 */
import { db, pool } from "@/db";
import { municipalities } from "@/db/schema";

const MUNICIPALITIES = [
  { id: "sabaneta", name: "Sabaneta" },
  { id: "moncion", name: "Monción" },
  { id: "villa-los-almacigos", name: "Villa Los Almácigos" },
] as const;

async function main() {
  for (const municipality of MUNICIPALITIES) {
    await db
      .insert(municipalities)
      .values(municipality)
      .onConflictDoUpdate({
        target: municipalities.id,
        set: { name: municipality.name },
      });
  }

  console.log(`seeded ${MUNICIPALITIES.length} municipalities`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
