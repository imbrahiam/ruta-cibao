import { and, asc, eq, isNull } from "drizzle-orm";
import { db, pool } from "@/db";
import { places } from "@/db/schema";
import { env } from "@/lib/env";
import { resolveGooglePlace } from "@/modules/places/google-photo";
import { appThumbnailKey } from "@/modules/places/thumbnail";

async function main() {
  if (!env.GOOGLE_MAPS_SERVER_API_KEY) {
    throw new Error(
      "GOOGLE_MAPS_SERVER_API_KEY is required for place matching.",
    );
  }
  const candidates = await db
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.status, "published"), isNull(appThumbnailKey)))
    .orderBy(asc(places.id));
  let matched = 0;
  let failed = 0;
  for (const [index, place] of candidates.entries()) {
    if (index > 0) await Bun.sleep(200);
    try {
      if (await resolveGooglePlace(place)) matched++;
    } catch {
      failed++;
    }
  }
  console.log(
    `Google place matching: ${candidates.length} checked, ${matched} matched, ${failed} failed.`,
  );
  if (failed) process.exitCode = 1;
}

try {
  await main();
} catch {
  console.error(
    "Google place matching failed. Check database and server Places API configuration.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
