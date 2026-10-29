import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
  type OfflineBoundaries,
  type OfflineCategory,
  type OfflineManifest,
  type OfflinePlace,
  type OfflineRoad,
  type OfflineSnapshot,
  offlineBoundariesSchema,
  offlineManifestOutput,
  offlineSnapshotSchema,
  routeOutput,
} from "@ruta/contracts";
import { COUNTRY_BOUNDS, OFFLINE_PROVINCE_BOUNDS } from "@ruta/shared/geo";
import { formatPhone } from "@ruta/shared/phone";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { type Db, type DbTransaction, db } from "@/db";
import {
  businessClaims,
  categories,
  ecoRoutes,
  municipalities,
  offlineSnapshots,
  placePhotos,
  places,
  roads,
} from "@/db/schema";
import { env } from "@/lib/env";
import { drainOutbox, enqueueJob } from "@/lib/jobs/outbox";
import { QUEUES } from "@/lib/jobs/queues";
import { errorDetails, logError } from "@/lib/log";
import { getObjectBytes, putObject } from "@/lib/storage";
import { MAX_PHOTOS_PER_PLACE } from "@/modules/places/photos";

const SNAPSHOT_PREFIX = "offline-snapshots/";

type Executor = Db | DbTransaction;

export async function readMunicipalBoundaries(
  executor: Executor = db,
): Promise<OfflineBoundaries> {
  const rows = await executor
    .select({
      id: municipalities.id,
      name: municipalities.name,
      geometry: sql<string>`ST_AsGeoJSON(ST_SimplifyPreserveTopology(${municipalities.boundary}, 0.0001), 5)`,
      label: sql<string>`ST_AsGeoJSON(ST_PointOnSurface(${municipalities.boundary}))`,
    })
    .from(municipalities)
    .where(isNotNull(municipalities.boundary))
    .orderBy(asc(municipalities.id));

  const [west, south, east, north] = COUNTRY_BOUNDS;
  const [province] = rows.length
    ? await executor
        .select({
          geometry: sql<string>`ST_AsGeoJSON(
            ST_SimplifyPreserveTopology(ST_Union(${municipalities.boundary}), 0.0001)
          , 5)`,
          outside: sql<string>`ST_AsGeoJSON(ST_Difference(
            ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326),
            ST_SimplifyPreserveTopology(ST_Union(${municipalities.boundary}), 0.0001)
          ), 5)`,
        })
        .from(municipalities)
        .where(isNotNull(municipalities.boundary))
    : [];

  return offlineBoundariesSchema.parse({
    type: "FeatureCollection",
    features: rows.map((row) => {
      const parsedLabel: unknown = JSON.parse(row.label);
      const coordinates =
        parsedLabel &&
        typeof parsedLabel === "object" &&
        "coordinates" in parsedLabel
          ? parsedLabel.coordinates
          : null;
      return {
        type: "Feature",
        id: row.id,
        properties: {
          id: row.id,
          name: row.name,
          label: coordinates,
        },
        geometry: JSON.parse(row.geometry) as unknown,
      };
    }),
    province: province ? (JSON.parse(province.geometry) as unknown) : null,
    outside: province ? (JSON.parse(province.outside) as unknown) : null,
  });
}

export async function readActiveCategoriesForSnapshot(
  executor: Executor = db,
): Promise<OfflineCategory[]> {
  return executor
    .select({
      id: categories.id,
      kind: categories.kind,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      severity: categories.severity,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(
      asc(categories.kind),
      asc(categories.sortOrder),
      asc(categories.id),
    );
}

export async function readPublishedPlacesForSnapshot(
  executor: Executor = db,
): Promise<OfflinePlace[]> {
  const rows = await executor
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      description: places.description,
      address: places.address,
      imageUrl: places.imageUrl,
      location: places.location,
      businessDetails: places.businessDetails,
      categoryId: categories.id,
      categoryKind: categories.kind,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
    .where(eq(places.status, "published"))
    .orderBy(asc(places.name), asc(places.id));

  if (rows.length === 0) return [];

  const placeIds = rows.map((row) => row.id);
  const [photoRows, claimRows] = await Promise.all([
    executor
      .select({
        id: placePhotos.id,
        placeId: placePhotos.placeId,
      })
      .from(placePhotos)
      .where(
        and(
          inArray(placePhotos.placeId, placeIds),
          eq(placePhotos.status, "published"),
        ),
      )
      .orderBy(asc(placePhotos.createdAt), asc(placePhotos.id)),
    executor
      .select({
        placeId: businessClaims.placeId,
        contactPhone: businessClaims.contactPhone,
        whatsapp: businessClaims.whatsapp,
        openingHours: businessClaims.openingHours,
      })
      .from(businessClaims)
      .where(
        and(
          inArray(businessClaims.placeId, placeIds),
          eq(businessClaims.status, "approved"),
        ),
      ),
  ]);

  const photoIdsByPlace = new Map<string, string[]>();
  for (const photo of photoRows) {
    const list = photoIdsByPlace.get(photo.placeId) ?? [];
    if (list.length < MAX_PHOTOS_PER_PLACE) {
      list.push(photo.id);
      photoIdsByPlace.set(photo.placeId, list);
    }
  }

  const claimByPlace = new Map(
    claimRows.map((claim) => [claim.placeId, claim]),
  );

  return rows.map((row) => {
    const kind = row.categoryKind === "business" ? "business" : "place";
    const approved = claimByPlace.get(row.id);
    const business =
      kind === "business"
        ? {
            claimed: Boolean(approved),
            contactPhone: approved?.contactPhone
              ? formatPhone(approved.contactPhone)
              : approved
                ? null
                : row.businessDetails?.contactPhone || null,
            whatsapp: approved?.whatsapp
              ? formatPhone(approved.whatsapp)
              : approved
                ? null
                : row.businessDetails?.whatsapp || null,
            openingHours: approved
              ? approved.openingHours
              : row.businessDetails?.openingHours || null,
          }
        : null;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      address: row.address,
      // Only non-expiring public static paths belong in an offline snapshot;
      // uploaded photographs are referenced by approved photo IDs.
      imageUrl: row.imageUrl?.startsWith("/") ? row.imageUrl : null,
      photoIds: photoIdsByPlace.get(row.id) ?? [],
      location: { lng: row.location.x, lat: row.location.y },
      category: {
        id: row.categoryId,
        kind,
        name: row.categoryName,
        icon: row.categoryIcon,
        color: row.categoryColor,
      },
      municipality: {
        id: row.municipalityId,
        name: row.municipalityName,
      },
      business,
    };
  });
}

export async function readPublishedRoutesForSnapshot(executor: Executor = db) {
  const rows = await executor
    .select({
      route: ecoRoutes,
      categoryName: categories.name,
      municipalityName: municipalities.name,
    })
    .from(ecoRoutes)
    .innerJoin(categories, eq(categories.id, ecoRoutes.categoryId))
    .innerJoin(municipalities, eq(municipalities.id, ecoRoutes.municipalityId))
    .where(eq(ecoRoutes.status, "published"))
    .orderBy(desc(ecoRoutes.createdAt), asc(ecoRoutes.id));

  return rows.map(({ route, categoryName, municipalityName }) =>
    routeOutput.parse({
      ...route,
      reviewNote: null,
      categoryName,
      municipalityName,
      path: route.path.map(({ x, y }) => ({ lng: x, lat: y })),
      createdAt: route.createdAt.toISOString(),
    }),
  );
}

export async function readRoadsForSnapshot(
  executor: Executor = db,
): Promise<OfflineRoad[]> {
  const rows = await executor
    .select({
      id: roads.id,
      name: roads.name,
      kind: roads.kind,
      path: roads.path,
    })
    .from(roads)
    .orderBy(asc(roads.id));

  const out: OfflineRoad[] = [];
  for (const row of rows) {
    const path = row.path.map(({ x, y }) => ({ lng: x, lat: y }));
    if (path.length >= 2) {
      out.push({
        id: row.id,
        name: row.name,
        kind: row.kind,
        path,
      });
    }
  }
  return out;
}

/**
 * Builds and publishes a new immutable versioned offline snapshot.
 *
 * The manifest row is marked current only after the object upload and schema
 * validation succeed, so a failed build leaves the previous valid snapshot in
 * place. If a privacy or abuse revocation occurs mid-build, the build retries
 * so pre-revocation data cannot become current.
 */
export async function buildOfflineSnapshot(): Promise<{
  version: string;
  sha256: string;
  sizeBytes: number;
  generatedAt: string;
}> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const generatedAt = new Date();
    const stamp = generatedAt.toISOString().replace(/\D/g, "").slice(0, 14);
    const version = `v1-${stamp}-${crypto.randomUUID().slice(0, 8)}`;

    const [categoryItems, boundaries, placeItems, routeItems, roadItems] =
      await Promise.all([
        readActiveCategoriesForSnapshot(db),
        readMunicipalBoundaries(db),
        readPublishedPlacesForSnapshot(db),
        readPublishedRoutesForSnapshot(db),
        readRoadsForSnapshot(db),
      ]);

    const payload: OfflineSnapshot = offlineSnapshotSchema.parse({
      schemaVersion: 1,
      version,
      generatedAt: generatedAt.toISOString(),
      categories: categoryItems,
      boundaries,
      places: placeItems,
      routes: routeItems,
      roads: roadItems,
    });

    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const sizeBytes = bytes.byteLength;
    const storageKey = `${SNAPSHOT_PREFIX}${version}.json`;

    await putObject(storageKey, bytes, "application/json");

    const activated = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(713210)`);
      const [revokedSinceStart] = await tx
        .select({ version: offlineSnapshots.version })
        .from(offlineSnapshots)
        .where(gt(offlineSnapshots.revokedAt, generatedAt))
        .limit(1);

      if (revokedSinceStart) {
        await tx.insert(offlineSnapshots).values({
          version,
          schemaVersion: 1,
          storageKey,
          sha256,
          sizeBytes,
          generatedAt,
          isCurrent: false,
          revokedAt: new Date(),
          revokedReason: "superseded_by_concurrent_revocation",
        });
        return false;
      }

      await tx
        .update(offlineSnapshots)
        .set({ isCurrent: false })
        .where(eq(offlineSnapshots.isCurrent, true));

      await tx.insert(offlineSnapshots).values({
        version,
        schemaVersion: 1,
        storageKey,
        sha256,
        sizeBytes,
        generatedAt,
        isCurrent: true,
      });
      return true;
    });

    if (activated) {
      return {
        version,
        sha256,
        sizeBytes,
        generatedAt: generatedAt.toISOString(),
      };
    }
  }

  throw new Error(
    "Offline snapshot build was repeatedly superseded by revocations.",
  );
}

/**
 * Immediately revokes all active offline snapshot versions (410) after a
 * privacy or abuse removal and queues a fresh replacement snapshot.
 */
export async function revokeOfflineSnapshots(
  reason: string,
  executor: Executor = db,
): Promise<void> {
  const now = new Date();
  await executor
    .update(offlineSnapshots)
    .set({
      isCurrent: false,
      revokedAt: now,
      revokedReason: reason,
    })
    .where(isNull(offlineSnapshots.revokedAt));
}

export async function scheduleOfflineSnapshotRebuild(
  tx: DbTransaction,
): Promise<void> {
  await enqueueJob(tx, QUEUES.offlineSnapshot, {});
}

export async function triggerOfflineSnapshotRebuild(): Promise<void> {
  await db.transaction((tx) => scheduleOfflineSnapshotRebuild(tx));
  if (!env.JOBS_ENABLED) {
    await drainOutbox().catch((error) => {
      logError("offline.snapshot_inline_failed", errorDetails(error));
    });
  }
}

export async function getOfflineManifest(): Promise<OfflineManifest> {
  let [current] = await db
    .select()
    .from(offlineSnapshots)
    .where(
      and(
        eq(offlineSnapshots.isCurrent, true),
        isNull(offlineSnapshots.revokedAt),
      ),
    )
    .orderBy(desc(offlineSnapshots.generatedAt))
    .limit(1);

  if (!current) {
    const [anySnapshot] = await db
      .select({ version: offlineSnapshots.version })
      .from(offlineSnapshots)
      .limit(1);

    if (!anySnapshot) {
      await buildOfflineSnapshot();
      [current] = await db
        .select()
        .from(offlineSnapshots)
        .where(
          and(
            eq(offlineSnapshots.isCurrent, true),
            isNull(offlineSnapshots.revokedAt),
          ),
        )
        .orderBy(desc(offlineSnapshots.generatedAt))
        .limit(1);
    }
  }

  if (!current) {
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "Offline snapshot is being rebuilt.",
      data: { reason: "snapshot_unavailable" },
    });
  }

  const origin = env.APP_URL.replace(/\/+$/, "");
  return offlineManifestOutput.parse({
    version: current.version,
    generatedAt: current.generatedAt.toISOString(),
    bounds: [...OFFLINE_PROVINCE_BOUNDS] as [number, number, number, number],
    snapshotUrl: `${origin}/api/offline/snapshots/${encodeURIComponent(current.version)}`,
    snapshotSha256: current.sha256,
    snapshotBytes: current.sizeBytes,
  });
}

export async function readOfflineSnapshotArtifact(
  version: string,
): Promise<
  | { status: "ok"; bytes: Uint8Array; sha256: string }
  | { status: "revoked" }
  | { status: "not_found" }
> {
  const [row] = await db
    .select()
    .from(offlineSnapshots)
    .where(eq(offlineSnapshots.version, version))
    .limit(1);

  if (!row) return { status: "not_found" };
  if (row.revokedAt !== null) return { status: "revoked" };

  const bytes = await getObjectBytes(row.storageKey);
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== row.sha256 || bytes.byteLength !== row.sizeBytes) {
    throw new Error(`Offline snapshot ${version} failed integrity check.`);
  }
  return { status: "ok", bytes, sha256: row.sha256 };
}

export { SNAPSHOT_PREFIX };
