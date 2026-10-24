/**
 * Imports the real OSM track Camino Los Cacaos, not a field-certified trail.
 *
 * Offline replay (requires an existing contact-verified staff account):
 *   bun --env-file=.env scripts/import-osm-route.ts --staff-user-id=<id>
 * Refresh the committed GeoJSON from Overpass, then import:
 *   bun --env-file=.env scripts/import-osm-route.ts --staff-user-id=<id> --refresh
 *
 * OSM contributors / ODbL 1.0. The snapshot retains all named path/track/footway
 * candidates and hiking-relation IDs returned for PROVINCE_BOUNDS. PostGIS checks
 * the complete selected line against the actual municipal polygons, not just its
 * bounding box. No coordinates are interpolated or invented.
 *
 * Selection: way 291502845 is a named ground track entirely within Monción.
 * The other named candidates are streets; no hiking relation was returned on
 * 2026-10-24. No access, services, elevation, or field-safety verification is
 * implied by importing an OSM track. Duration assumes 4 km/h without elevation;
 * difficulty is a distance-only estimate (<=2 km easy, <=10 km moderate, else hard).
 *
 * Existing submitRoute/decideRoute services perform validation, measurement,
 * publication, audit, realtime and offline-snapshot scheduling. A persistent
 * source URL identifies the imported route even after request-key expiry; a
 * session advisory lock serializes replays. Changed snapshots fail closed rather
 * than silently overwriting a published route or creating another copy.
 */
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { submitRouteInput } from "@ruta/contracts";
import { PROVINCE_BOUNDS } from "@ruta/shared/geo";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "@/db";
import { auditEvents, ecoRoutes, memberProfiles, user } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import {
  assertModerates,
  requireModerator,
} from "@/modules/access/permissions";
import { toViewer } from "@/modules/access/viewer";
import { decideRoute, submitRoute } from "@/modules/routes/service";

const SOURCE_ID = 291502845;
const SOURCE_URL = `https://www.openstreetmap.org/way/${SOURCE_ID}`;
const SNAPSHOT = new URL(
  "../data/content/santiago-rodriguez-osm-routes.geojson",
  import.meta.url,
);
const coordinate = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const snapshotSchema = z.object({
  type: z.literal("FeatureCollection"),
  provenance: z.object({
    source: z.literal("OpenStreetMap"),
    license: z.literal("ODbL-1.0"),
    attribution: z.string(),
    licenseUrl: z.url(),
    retrievedAt: z.iso.datetime(),
    endpoint: z.url(),
    query: z.string(),
    hikingRelationIds: z.array(z.number().int()),
  }),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      geometry: z.object({
        type: z.literal("LineString"),
        coordinates: z.array(coordinate).min(2),
      }),
      properties: z.object({
        osmType: z.literal("way"),
        osmId: z.number().int(),
        osmVersion: z.number().int(),
        osmTimestamp: z.iso.datetime(),
        tags: z.record(z.string(), z.string()),
      }),
    }),
  ),
});
const overpassSchema = z.object({
  elements: z.array(
    z.object({
      type: z.enum(["way", "relation"]),
      id: z.number().int(),
      version: z.number().int(),
      timestamp: z.iso.datetime(),
      tags: z.record(z.string(), z.string()).default({}),
      geometry: z
        .array(z.object({ lon: z.number(), lat: z.number() }))
        .optional(),
    }),
  ),
});

function requestId(operation: string): string {
  const bytes = createHash("sha256")
    .update(`ruta:osm-route:${SOURCE_ID}:${operation}`)
    .digest();
  bytes[6] = ((bytes[6] ?? 0) & 15) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function refreshSnapshot() {
  const [west, south, east, north] = PROVINCE_BOUNDS;
  const bbox = `${south},${west},${north},${east}`;
  const query = `[out:json][timeout:90];(way["highway"~"^(path|track|footway)$"]["name"](${bbox});relation["route"="hiking"](${bbox}););out meta geom;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = overpassSchema.parse(await response.json());
      const snapshot = snapshotSchema.parse({
        type: "FeatureCollection",
        provenance: {
          source: "OpenStreetMap",
          license: "ODbL-1.0",
          attribution: "© OpenStreetMap contributors",
          licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
          retrievedAt: new Date().toISOString(),
          endpoint,
          query,
          hikingRelationIds: result.elements
            .filter((item) => item.type === "relation")
            .map((item) => item.id),
        },
        features: result.elements
          .filter((item) => item.type === "way" && item.geometry)
          .map((item) => ({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: item.geometry?.map(({ lon, lat }) => [lon, lat]),
            },
            properties: {
              osmType: "way",
              osmId: item.id,
              osmVersion: item.version,
              osmTimestamp: item.timestamp,
              tags: item.tags,
            },
          })),
      });
      if (
        !snapshot.features.some(
          (feature) => feature.properties.osmId === SOURCE_ID,
        )
      )
        throw new Error(
          "Selected OSM track is absent; inspect candidates before changing the import",
        );
      await Bun.write(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`);
      return;
    } catch (error) {
      console.warn(
        `Overpass fetch failed at ${endpoint}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
  throw new Error("No Overpass mirror returned a valid route snapshot");
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "staff-user-id": { type: "string" },
    refresh: { type: "boolean", default: false },
  },
  strict: true,
});
if (!values["staff-user-id"])
  throw new Error(
    "Pass --staff-user-id for an existing authorized staff account",
  );

try {
  const [account] = await db
    .select({
      profile: memberProfiles,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneNumberVerified,
      image: user.image,
    })
    .from(memberProfiles)
    .innerJoin(user, eq(user.id, memberProfiles.userId))
    .where(eq(user.id, values["staff-user-id"]))
    .limit(1);
  if (!account) throw new Error("Staff account/profile not found");
  const staff = requireModerator(
    toViewer(values["staff-user-id"], account.profile, {
      image: account.image,
      contactVerified: account.emailVerified || account.phoneVerified === true,
    }),
  );
  if (values.refresh) await refreshSnapshot();
  const snapshot = snapshotSchema.parse(await Bun.file(SNAPSHOT).json());
  const feature = snapshot.features.find(
    (item) => item.properties.osmId === SOURCE_ID,
  );
  if (!feature) throw new Error("Selected OSM way is absent from snapshot");
  const tags = feature.properties.tags;
  if (
    !tags.name ||
    !["path", "track", "footway"].includes(tags.highway ?? "") ||
    tags.foot === "no" ||
    (tags.access === "no" && tags.foot !== "yes")
  )
    throw new Error(
      "Selected way is not a named walkable candidate; review OSM tags",
    );
  const geometry = JSON.stringify(feature.geometry);
  const measured = await db.execute<{
    inside: boolean;
    municipality_id: string;
    municipality_name: string;
    meters: number;
  }>(sql`
    with route as (select ST_SetSRID(ST_GeomFromGeoJSON(${geometry}), 4326) as path)
    select ST_CoveredBy(path, (select ST_Union(boundary) from municipalities)) as inside,
      m.id as municipality_id, m.name as municipality_name,
      round(ST_Length(path::geography))::int as meters
    from route join municipalities m on ST_Covers(m.boundary, ST_StartPoint(path))
    order by m.id limit 1
  `);
  const area = measured.rows[0];
  if (!area?.inside)
    throw new Error(
      "OSM line is not entirely within the DB municipal polygons",
    );
  assertModerates(staff, area.municipality_id);
  const durationMinutes = Math.max(5, Math.ceil((area.meters / 4000) * 60));
  const difficulty =
    area.meters <= 2000 ? "easy" : area.meters <= 10000 ? "moderate" : "hard";
  const description = `Camino cartografiado en OpenStreetMap como ${tags.highway}, en ${area.municipality_name}. Distancia calculada sobre el trazado: ${(area.meters / 1000).toFixed(2)} km, solo ida. Duración estimada: ${durationMinutes} minutos a pie, a 4 km/h, sin incluir descansos ni desnivel; no se dispone de elevación verificada. Dificultad estimada únicamente por distancia (hasta 2 km: fácil; hasta 10 km: moderada; más de 10 km: difícil). No es una ruta de senderismo certificada ni verificada en campo; el acceso, el estado actual y las condiciones deben comprobarse localmente. No se han verificado servicios. Fuente: ${SOURCE_URL}, versión ${feature.properties.osmVersion}, consulta ${snapshot.provenance.retrievedAt.slice(0, 10)}. © OpenStreetMap contributors, ODbL 1.0.`;
  const input = submitRouteInput.parse({
    requestId: requestId("submit"),
    name: tags.name,
    description,
    categoryId: "senderismo",
    path: feature.geometry.coordinates.map(([lng, lat]) => ({ lng, lat })),
    durationMinutes,
    difficulty,
    services: [],
  });
  const note = `Importación cartográfica, no certificación de seguridad. ${SOURCE_URL}; ODbL 1.0. Tiempo y dificultad estimados solo por distancia; sin elevación ni servicios verificados.`;
  const lock = await pool.connect();
  try {
    await lock.query("select pg_advisory_lock(hashtext($1))", [
      `osm-route:${SOURCE_ID}`,
    ]);
    const existing = await db
      .select()
      .from(ecoRoutes)
      .where(sql`position(${SOURCE_URL} in ${ecoRoutes.description}) > 0`);
    if (existing.length > 1)
      throw new Error(
        "Multiple routes reference this OSM way; resolve duplicates explicitly",
      );
    const previous = existing[0];
    if (
      previous &&
      (previous.description !== description ||
        previous.name !== input.name ||
        previous.distanceMeters !== area.meters ||
        previous.durationMinutes !== durationMinutes ||
        previous.difficulty !== difficulty ||
        previous.services.length !== 0 ||
        previous.categoryId !== input.categoryId ||
        previous.municipalityId !== area.municipality_id ||
        JSON.stringify(
          previous.path.map(({ x, y }) => ({ lng: x, lat: y })),
        ) !== JSON.stringify(input.path))
    )
      throw new Error(
        "Existing source route differs; review changes instead of overwriting it",
      );
    const routeId = previous?.id ?? (await submitRoute(staff, input)).id;
    if (!previous || previous.status === "pending")
      await decideRoute(staff, {
        requestId: requestId(`publish:${routeId}`),
        id: routeId,
        status: "published",
        note,
      });
    else if (previous.status !== "published")
      throw new Error("Route was rejected; do not silently republish it");
    const [audit] = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "route.osmImported"),
          eq(auditEvents.subjectId, routeId),
        ),
      )
      .limit(1);
    if (!audit)
      await recordAudit({
        actorUserId: staff.userId,
        action: "route.osmImported",
        subjectType: "route",
        subjectId: routeId,
        municipalityId: area.municipality_id,
        metadata: {
          source: "OpenStreetMap",
          osmType: "way",
          osmId: SOURCE_ID,
          osmVersion: feature.properties.osmVersion,
          license: snapshot.provenance.license,
          retrievedAt: snapshot.provenance.retrievedAt,
          snapshotSha256: createHash("sha256")
            .update(await Bun.file(SNAPSHOT).text())
            .digest("hex"),
          durationRule: "distance / 4 km/h, no elevation",
          difficultyRule: "<=2 km easy; <=10 km moderate; otherwise hard",
        },
      });
    console.log(
      JSON.stringify(
        {
          id: routeId,
          name: input.name,
          municipality: area.municipality_name,
          distanceMeters: area.meters,
          durationMinutes,
          difficulty,
          points: input.path.length,
          osmIds: [`way/${SOURCE_ID}`],
          status: "published",
          reused: Boolean(previous),
        },
        null,
        2,
      ),
    );
  } finally {
    await lock.query("select pg_advisory_unlock(hashtext($1))", [
      `osm-route:${SOURCE_ID}`,
    ]);
    lock.release();
  }
} finally {
  await pool.end();
}
