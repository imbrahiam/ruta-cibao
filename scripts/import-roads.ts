/**
 * Loads the province's road network into PostGIS, once.
 *
 * The map shades the street a traffic report covers, which means knowing that
 * street's shape. OpenStreetMap is the only source that gives it — Google's
 * Roads API snaps points to the network without returning the way they landed
 * on — so the geometry comes from OSM through Overpass.
 *
 * It comes through Overpass *here*, in a script somebody runs, rather than on
 * every map idle. The per-request version worked in testing and then stopped:
 * the public instances rate-limit by IP and eventually refuse the connection
 * outright, at which point every lookup surfaced to a citizen as "aquí no
 * encontramos una calle" — the map blaming the road for a quota.
 *
 * Overpass is asked for the whole province in one query, which is the polite
 * shape for this: one request every few months instead of thousands a day.
 *
 *   bun run db:roads
 *
 * Re-running is safe. Ways are upserted on their OSM id, so a road that has
 * been redrawn is updated in place and nothing is duplicated.
 *
 * Road data © OpenStreetMap contributors, ODbL.
 */

import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { roads } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Ways people drive on.
 *
 * Footpaths and steps are excluded because a traffic report about them helps
 * nobody in a car, and they are what a crosshair in a town centre would
 * otherwise snap to. `track` stays: a great deal of real traffic in this
 * province happens on them.
 */
const EXCLUDED =
  "footway|path|steps|cycleway|bridleway|corridor|platform|proposed|construction|raceway|elevator";

/**
 * Mirrors, tried in order.
 *
 * The main instance is the one that rate-limits hardest, and an import that
 * fails because somebody else was busy is an import that has to be babysat.
 * `OVERPASS_URL` goes first when it is set to something other than the default,
 * so pointing this at a private instance needs no code change.
 */
const MIRRORS = [
  env.OVERPASS_URL,
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
  "https://overpass-api.de/api/interpreter",
].filter((url, index, all) => url.length > 0 && all.indexOf(url) === index);

type OverpassWay = {
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

async function fetchWays(): Promise<OverpassWay[]> {
  const [west, south, east, north] = PROVINCE_BOUNDS;
  // A little past the provincial line: a road that leaves the province is
  // still the road somebody is standing on at the edge of it.
  const margin = 0.03;
  const bbox = `${south - margin},${west - margin},${north + margin},${east + margin}`;

  const query = `[out:json][timeout:180];way(${bbox})["highway"]["highway"!~"^(${EXCLUDED})$"];out geom;`;

  const failures: string[] = [];

  for (const mirror of MIRRORS) {
    process.stdout.write(`  ${new URL(mirror).host} … `);
    try {
      const response = await fetch(mirror, {
        method: "POST",
        body: query,
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          "user-agent": `RutaCibao/0.1 (${env.APP_URL})`,
        },
        // Generous: this asks for a whole province and runs once.
        signal: AbortSignal.timeout(240_000),
      });

      if (!response.ok) {
        console.log(`HTTP ${response.status}`);
        failures.push(`${mirror}: HTTP ${response.status}`);
        continue;
      }

      const data = (await response.json()) as { elements?: OverpassWay[] };
      const ways = (data.elements ?? []).filter(
        (way) => (way.geometry?.length ?? 0) >= 2,
      );

      console.log(`${ways.length} ways`);
      return ways;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.log(reason);
      failures.push(`${mirror}: ${reason}`);
    }
  }

  throw new Error(
    `No Overpass mirror could be reached.\n${failures.map((line) => `  ${line}`).join("\n")}`,
  );
}

async function main() {
  console.log("asking Overpass for the province's roads:");
  const ways = await fetchWays();

  if (ways.length === 0) {
    throw new Error("Overpass returned no roads; refusing to empty the table.");
  }

  // In batches: a province is tens of thousands of vertices, and one statement
  // carrying all of them is a query nothing enjoys parsing.
  const BATCH = 200;
  let written = 0;

  for (let start = 0; start < ways.length; start += BATCH) {
    const batch = ways.slice(start, start + BATCH).map((way) => ({
      id: String(way.id),
      name: way.tags?.name ?? null,
      kind: way.tags?.highway ?? "unclassified",
      path: (way.geometry ?? []).map((node) => ({ x: node.lon, y: node.lat })),
      importedAt: new Date(),
    }));

    await db
      .insert(roads)
      .values(batch)
      .onConflictDoUpdate({
        target: roads.id,
        set: {
          name: sql`excluded.name`,
          kind: sql`excluded.kind`,
          path: sql`excluded.path`,
          importedAt: sql`excluded.imported_at`,
        },
      });

    written += batch.length;
    process.stdout.write(`\r  stored ${written}/${ways.length}`);
  }

  console.log();

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(roads);
  const [named] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(roads)
    .where(sql`${roads.name} is not null`);

  console.log(
    `roads: ${counted?.total ?? 0} in the table, ${named?.total ?? 0} with a name`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
