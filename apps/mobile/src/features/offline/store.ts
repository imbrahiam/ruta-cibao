import {
  type EcoRoute,
  type OfflineBoundaries,
  type OfflineCategory,
  type OfflinePlace,
  type OfflineRoad,
  offlineBoundariesSchema,
  offlineBoundsSchema,
  offlineCategorySchema,
  offlinePlaceSchema,
  offlineRoadSchema,
  routeOutput,
} from "@ruta/contracts";
import * as Network from "expo-network";
import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";
import type { PlaceCollection } from "@/features/map/data";
import { API_ORIGIN } from "@/lib/config";
import { getOfflineDb, withOfflineWrite } from "./db";
import {
  type DownloadProgress,
  type DownloadStage,
  fetchAndValidateOfflineSnapshot,
  OfflineValidationError,
  type OfflineValidationErrorCode,
  validateOfflineSnapshotBytes,
} from "./validate";

export { sha256Hex } from "./sha256";
export {
  type DownloadProgress,
  type DownloadStage,
  fetchAndValidateOfflineSnapshot,
  OfflineValidationError,
  type OfflineValidationErrorCode,
  validateOfflineSnapshotBytes,
};

export type OfflineSnapshotMeta = {
  version: string;
  generatedAt: string;
  downloadedAt: string;
  sha256: string;
  sizeBytes: number;
  bounds: [number, number, number, number];
  placeCount: number;
  routeCount: number;
  roadCount: number;
};

type MetaRow = {
  version: string;
  generated_at: string;
  downloaded_at: string;
  sha256: string;
  size_bytes: number;
  bounds_json: string;
  place_count: number;
  route_count: number;
  road_count: number;
};

type StoreState = {
  initialized: boolean;
  snapshot: OfflineSnapshotMeta | null;
  downloading: boolean;
  progress: DownloadProgress | null;
  error: OfflineValidationErrorCode | null;
};

let state: StoreState = {
  initialized: false,
  snapshot: null,
  downloading: false,
  progress: null,
  error: null,
};

const listeners = new Set<() => void>();
let initPromise: Promise<OfflineSnapshotMeta | null> | undefined;
let activeDownload: Promise<OfflineSnapshotMeta> | undefined;

function setState(patch: Partial<StoreState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

function rowToMeta(row: MetaRow): OfflineSnapshotMeta {
  const parsedBounds = offlineBoundsSchema.safeParse(
    JSON.parse(row.bounds_json),
  );
  return {
    version: row.version,
    generatedAt: row.generated_at,
    downloadedAt: row.downloaded_at,
    sha256: row.sha256,
    sizeBytes: row.size_bytes,
    bounds: parsedBounds.success
      ? parsedBounds.data
      : [-71.54, 19.15, -71.05, 19.59],
    placeCount: row.place_count,
    routeCount: row.route_count,
    roadCount: row.road_count,
  };
}

/** Reads the currently active snapshot metadata from SQLite, if any. */
export async function getOfflineMeta(): Promise<OfflineSnapshotMeta | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<MetaRow>(
    `SELECT version, generated_at, downloaded_at, sha256, size_bytes, bounds_json, place_count, route_count, road_count
     FROM offline_meta
     WHERE slot = 1`,
  );
  const meta = row ? rowToMeta(row) : null;
  setState({ initialized: true, snapshot: meta });
  return meta;
}

function ensureInitialized(): Promise<OfflineSnapshotMeta | null> {
  initPromise ??= getOfflineMeta().catch(() => {
    setState({ initialized: true });
    return null;
  });
  return initPromise;
}

/**
 * Downloads the current offline manifest and snapshot, validates its origin,
 * byte length, SHA-256 checksum, and schema v1, and atomically swaps the
 * SQLite tables + FTS5 index inside one transaction.
 *
 * Any failure before or during the transaction leaves the previous valid
 * snapshot untouched.
 */
export function downloadOfflineSnapshot(options?: {
  origin?: string;
  onProgress?: (progress: DownloadProgress) => void;
}): Promise<OfflineSnapshotMeta> {
  if (activeDownload) return activeDownload;

  const origin = options?.origin ?? API_ORIGIN;
  const reportProgress = (progress: DownloadProgress) => {
    setState({ progress });
    options?.onProgress?.(progress);
  };

  setState({
    downloading: true,
    error: null,
    progress: { stage: "fetching_manifest", fraction: 0.02 },
  });

  activeDownload = (async () => {
    try {
      const { manifest, snapshot } = await fetchAndValidateOfflineSnapshot({
        origin,
        onProgress: reportProgress,
      });

      reportProgress({
        stage: "indexing",
        fraction: 0.8,
        loadedBytes: manifest.snapshotBytes,
        totalBytes: manifest.snapshotBytes,
      });

      const downloadedAt = new Date().toISOString();

      await withOfflineWrite(async (db) => {
        await db.withTransactionAsync(async () => {
          await db.execAsync(`
            DELETE FROM offline_fts;
            DELETE FROM offline_places;
            DELETE FROM offline_routes;
            DELETE FROM offline_roads;
            DELETE FROM offline_meta;
          `);

          const insertPlace = await db.prepareAsync(
            `INSERT INTO offline_places (
              id, slug, name, category_id, category_name, municipality_id, municipality_name, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          );
          const insertFts = await db.prepareAsync(
            `INSERT INTO offline_fts (
              entity_kind, entity_id, name, category_name, municipality_name, road_name
            ) VALUES (?, ?, ?, ?, ?, ?)`,
          );

          try {
            for (const place of snapshot.places) {
              await insertPlace.executeAsync([
                place.id,
                place.slug,
                place.name,
                place.category.id,
                place.category.name,
                place.municipality.id,
                place.municipality.name,
                JSON.stringify(place),
              ]);
              await insertFts.executeAsync([
                "place",
                place.id,
                place.name,
                place.category.name,
                place.municipality.name,
                place.address ?? "",
              ]);
            }

            reportProgress({
              stage: "indexing",
              fraction: 0.88,
              loadedBytes: manifest.snapshotBytes,
              totalBytes: manifest.snapshotBytes,
            });

            const insertRoute = await db.prepareAsync(
              `INSERT INTO offline_routes (
                id, municipality_id, difficulty, name, payload_json
              ) VALUES (?, ?, ?, ?, ?)`,
            );
            try {
              for (const route of snapshot.routes) {
                await insertRoute.executeAsync([
                  route.id,
                  route.municipalityId,
                  route.difficulty,
                  route.name,
                  JSON.stringify(route),
                ]);
              }
            } finally {
              await insertRoute.finalizeAsync();
            }

            reportProgress({
              stage: "indexing",
              fraction: 0.93,
              loadedBytes: manifest.snapshotBytes,
              totalBytes: manifest.snapshotBytes,
            });

            const insertRoad = await db.prepareAsync(
              `INSERT INTO offline_roads (
                id, name, kind, min_lng, min_lat, max_lng, max_lat, payload_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            );
            try {
              for (const road of snapshot.roads) {
                let minLng = Number.POSITIVE_INFINITY;
                let minLat = Number.POSITIVE_INFINITY;
                let maxLng = Number.NEGATIVE_INFINITY;
                let maxLat = Number.NEGATIVE_INFINITY;
                for (const pt of road.path) {
                  if (pt.lng < minLng) minLng = pt.lng;
                  if (pt.lat < minLat) minLat = pt.lat;
                  if (pt.lng > maxLng) maxLng = pt.lng;
                  if (pt.lat > maxLat) maxLat = pt.lat;
                }
                await insertRoad.executeAsync([
                  road.id,
                  road.name,
                  road.kind,
                  minLng,
                  minLat,
                  maxLng,
                  maxLat,
                  JSON.stringify(road),
                ]);
                if (road.name) {
                  await insertFts.executeAsync([
                    "road",
                    road.id,
                    road.name,
                    "",
                    "",
                    road.name,
                  ]);
                }
              }
            } finally {
              await insertRoad.finalizeAsync();
            }
          } finally {
            await insertPlace.finalizeAsync();
            await insertFts.finalizeAsync();
          }

          await db.runAsync(
            `INSERT INTO offline_meta (
              slot, version, generated_at, downloaded_at, sha256, size_bytes,
              bounds_json, boundaries_json, categories_json,
              place_count, route_count, road_count
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              manifest.version,
              manifest.generatedAt,
              downloadedAt,
              manifest.snapshotSha256,
              manifest.snapshotBytes,
              JSON.stringify(manifest.bounds),
              JSON.stringify(snapshot.boundaries),
              JSON.stringify(snapshot.categories),
              snapshot.places.length,
              snapshot.routes.length,
              snapshot.roads.length,
            ],
          );
        });
      });

      const meta: OfflineSnapshotMeta = {
        version: manifest.version,
        generatedAt: manifest.generatedAt,
        downloadedAt,
        sha256: manifest.snapshotSha256,
        sizeBytes: manifest.snapshotBytes,
        bounds: manifest.bounds,
        placeCount: snapshot.places.length,
        routeCount: snapshot.routes.length,
        roadCount: snapshot.roads.length,
      };

      setState({
        initialized: true,
        snapshot: meta,
        downloading: false,
        progress: null,
        error: null,
      });
      return meta;
    } catch (error) {
      const code: OfflineValidationErrorCode =
        error instanceof OfflineValidationError ? error.code : "network";
      setState({
        downloading: false,
        progress: null,
        error: code,
      });
      throw error;
    } finally {
      activeDownload = undefined;
    }
  })();

  return activeDownload;
}

/**
 * Removes the downloaded public snapshot and FTS5 index from SQLite while
 * preserving any queued outbox contributions.
 */
export async function removeOfflineSnapshot(): Promise<void> {
  await withOfflineWrite(async (db) => {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DELETE FROM offline_fts;
        DELETE FROM offline_places;
        DELETE FROM offline_routes;
        DELETE FROM offline_roads;
        DELETE FROM offline_meta;
      `);
    });
  });
  setState({
    initialized: true,
    snapshot: null,
    error: null,
    progress: null,
  });
}

function buildFtsMatchQuery(rawQuery: string): string | null {
  const tokens = rawQuery.trim().match(/[\p{L}\p{N}]+/gu);
  if (!tokens || tokens.length === 0) return null;
  return tokens.map((token) => `"${token.replace(/"/g, "")}"*`).join(" AND ");
}

/**
 * Searches offline places over FTS5 (place names, categories, municipalities,
 * and street addresses). Returns all downloaded places when `query` is blank.
 */
export async function offlineSearch(
  query: string,
  options?: { limit?: number },
): Promise<OfflinePlace[]> {
  const matchExpr = buildFtsMatchQuery(query);
  if (!matchExpr) {
    return offlinePlaces();
  }
  const db = await getOfflineDb();
  const limit = options?.limit ?? 100;
  const rows = await db.getAllAsync<{ payload_json: string }>(
    `SELECT p.payload_json
     FROM offline_fts f
     INNER JOIN offline_places p ON p.id = f.entity_id
     WHERE f.entity_kind = 'place' AND offline_fts MATCH ?
     ORDER BY bm25(offline_fts), p.name ASC
     LIMIT ?`,
    [matchExpr, limit],
  );
  const out: OfflinePlace[] = [];
  for (const row of rows) {
    const parsed = offlinePlaceSchema.safeParse(JSON.parse(row.payload_json));
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Searches offline OSM road segments by road name via the FTS5 index.
 */
export async function offlineSearchRoads(
  query: string,
  options?: { limit?: number },
): Promise<OfflineRoad[]> {
  const matchExpr = buildFtsMatchQuery(query);
  if (!matchExpr) return [];
  const db = await getOfflineDb();
  const limit = options?.limit ?? 50;
  const rows = await db.getAllAsync<{ payload_json: string }>(
    `SELECT r.payload_json
     FROM offline_fts f
     INNER JOIN offline_roads r ON r.id = f.entity_id
     WHERE f.entity_kind = 'road' AND offline_fts MATCH ?
     ORDER BY bm25(offline_fts), r.name ASC
     LIMIT ?`,
    [matchExpr, limit],
  );
  const out: OfflineRoad[] = [];
  for (const row of rows) {
    const parsed = offlineRoadSchema.safeParse(JSON.parse(row.payload_json));
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Reads all downloaded published places and businesses from SQLite, with
 * optional municipality or category filtering.
 */
export async function offlinePlaces(options?: {
  municipalityId?: string;
  categoryId?: string;
}): Promise<OfflinePlace[]> {
  const db = await getOfflineDb();
  const clauses: string[] = [];
  const params: string[] = [];

  if (options?.municipalityId) {
    clauses.push("municipality_id = ?");
    params.push(options.municipalityId);
  }
  if (options?.categoryId) {
    clauses.push("category_id = ?");
    params.push(options.categoryId);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await db.getAllAsync<{ payload_json: string }>(
    `SELECT payload_json FROM offline_places ${whereSql} ORDER BY name ASC`,
    params,
  );
  const out: OfflinePlace[] = [];
  for (const row of rows) {
    const parsed = offlinePlaceSchema.safeParse(JSON.parse(row.payload_json));
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Reads a single downloaded place or business by slug. */
export async function offlinePlaceBySlug(
  slug: string,
): Promise<OfflinePlace | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ payload_json: string }>(
    "SELECT payload_json FROM offline_places WHERE slug = ?",
    [slug],
  );
  if (!row) return null;
  const parsed = offlinePlaceSchema.safeParse(JSON.parse(row.payload_json));
  return parsed.success ? parsed.data : null;
}

/**
 * Projects downloaded places into the GeoJSON `PlaceCollection` shape used by
 * `features/map/data.ts`.
 */
export async function offlinePlaceCollection(): Promise<PlaceCollection> {
  const places = await offlinePlaces();
  return {
    type: "FeatureCollection",
    features: places.map((place) => ({
      type: "Feature" as const,
      id: place.id,
      geometry: {
        type: "Point" as const,
        coordinates: [place.location.lng, place.location.lat],
      },
      properties: {
        id: place.id,
        slug: place.slug,
        name: place.name,
        category: place.category.id,
        categoryName: place.category.name,
        municipality: place.municipality.id,
        color: place.category.color,
        icon: place.category.icon,
      },
    })),
  };
}

/** Reads all downloaded active categories from the active snapshot. */
export async function offlineCategories(): Promise<OfflineCategory[]> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ categories_json: string }>(
    "SELECT categories_json FROM offline_meta WHERE slot = 1",
  );
  if (!row) return [];
  const parsed = z
    .array(offlineCategorySchema)
    .safeParse(JSON.parse(row.categories_json));
  return parsed.success ? parsed.data : [];
}

/**
 * Reads all downloaded published ecotourism routes from SQLite, with optional
 * municipality or difficulty filtering.
 */
export async function offlineRoutes(options?: {
  municipalityId?: string;
  difficulty?: EcoRoute["difficulty"];
}): Promise<EcoRoute[]> {
  const db = await getOfflineDb();
  const clauses: string[] = [];
  const params: string[] = [];

  if (options?.municipalityId) {
    clauses.push("municipality_id = ?");
    params.push(options.municipalityId);
  }
  if (options?.difficulty) {
    clauses.push("difficulty = ?");
    params.push(options.difficulty);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await db.getAllAsync<{ payload_json: string }>(
    `SELECT payload_json FROM offline_routes ${whereSql} ORDER BY name ASC`,
    params,
  );
  const out: EcoRoute[] = [];
  for (const row of rows) {
    const parsed = routeOutput.safeParse(JSON.parse(row.payload_json));
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Reads a single downloaded ecotourism route by ID. */
export async function offlineRouteById(id: string): Promise<EcoRoute | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ payload_json: string }>(
    "SELECT payload_json FROM offline_routes WHERE id = ?",
    [id],
  );
  if (!row) return null;
  const parsed = routeOutput.safeParse(JSON.parse(row.payload_json));
  return parsed.success ? parsed.data : null;
}

/**
 * Reads the downloaded municipal boundary FeatureCollection (`features`,
 * `province`, `outside`) from SQLite, or `null` if no snapshot is stored.
 */
export async function offlineBoundaries(): Promise<OfflineBoundaries | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ boundaries_json: string }>(
    "SELECT boundaries_json FROM offline_meta WHERE slot = 1",
  );
  if (!row) return null;
  const parsed = offlineBoundariesSchema.safeParse(
    JSON.parse(row.boundaries_json),
  );
  return parsed.success ? parsed.data : null;
}

/**
 * Reads downloaded OSM road geometries, optionally filtered by a bounding box.
 */
export async function offlineRoads(bbox?: {
  west: number;
  south: number;
  east: number;
  north: number;
}): Promise<OfflineRoad[]> {
  const db = await getOfflineDb();
  const rows = bbox
    ? await db.getAllAsync<{ payload_json: string }>(
        `SELECT payload_json
         FROM offline_roads
         WHERE max_lng >= ? AND min_lng <= ? AND max_lat >= ? AND min_lat <= ?`,
        [bbox.west, bbox.east, bbox.south, bbox.north],
      )
    : await db.getAllAsync<{ payload_json: string }>(
        "SELECT payload_json FROM offline_roads",
      );
  const out: OfflineRoad[] = [];
  for (const row of rows) {
    const parsed = offlineRoadSchema.safeParse(JSON.parse(row.payload_json));
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Reactive hook for offline readiness, network connectivity, and snapshot
 * download/remove actions.
 */
export function useOfflineStatus() {
  const store = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
  const network = Network.useNetworkState();

  useEffect(() => {
    void ensureInitialized();
  }, []);

  const isOnline =
    network.isConnected !== false && network.isInternetReachable !== false;
  const isMetered =
    isOnline &&
    network.type !== Network.NetworkStateType.WIFI &&
    network.type !== Network.NetworkStateType.ETHERNET;

  return {
    ready: store.snapshot !== null,
    snapshot: store.snapshot,
    loading: !store.initialized,
    downloading: store.downloading,
    progress: store.progress,
    error: store.error,
    isOnline,
    isOffline: !isOnline,
    isMetered,
    networkType: network.type,
    download: downloadOfflineSnapshot,
    remove: removeOfflineSnapshot,
    refresh: getOfflineMeta,
  };
}
