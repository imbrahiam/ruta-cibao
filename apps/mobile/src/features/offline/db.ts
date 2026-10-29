import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { reportError } from "@/lib/report-error";

export const OFFLINE_DB_NAME = "ruta-cibao-offline.db";
export const OFFLINE_DB_KEY_STORAGE = "ruta-cibao.offline.db-key";

const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/;

let dbPromise: Promise<SQLite.SQLiteDatabase> | undefined;
let writeChain: Promise<unknown> = Promise.resolve();

function generateHexKey(): string {
  const bytes = new Uint8Array(32);
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (!cryptoApi?.getRandomValues) {
    // A key from Math.random is not a key. Refuse to create an encrypted store
    // that only looks encrypted; every runtime we ship provides Web Crypto.
    throw new Error(
      "No secure random source available for the offline database",
    );
  }
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function resolveDatabaseHexKey(): Promise<string> {
  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  };
  const existing = await SecureStore.getItemAsync(
    OFFLINE_DB_KEY_STORAGE,
    options,
  );
  if (existing && HEX_KEY_PATTERN.test(existing)) {
    return existing;
  }
  const fresh = generateHexKey();
  await SecureStore.setItemAsync(OFFLINE_DB_KEY_STORAGE, fresh, options);
  return fresh;
}

async function applySchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= 1) return;

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_meta (
        slot INTEGER PRIMARY KEY CHECK (slot = 1),
        version TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        downloaded_at TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        bounds_json TEXT NOT NULL,
        boundaries_json TEXT NOT NULL,
        categories_json TEXT NOT NULL,
        place_count INTEGER NOT NULL,
        route_count INTEGER NOT NULL,
        road_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_places (
        id TEXT PRIMARY KEY NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category_id TEXT NOT NULL,
        category_name TEXT NOT NULL,
        municipality_id TEXT NOT NULL,
        municipality_name TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_offline_places_municipality
        ON offline_places(municipality_id);
      CREATE INDEX IF NOT EXISTS idx_offline_places_category
        ON offline_places(category_id);

      CREATE TABLE IF NOT EXISTS offline_routes (
        id TEXT PRIMARY KEY NOT NULL,
        municipality_id TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_offline_routes_municipality
        ON offline_routes(municipality_id);

      CREATE TABLE IF NOT EXISTS offline_roads (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        kind TEXT NOT NULL,
        min_lng REAL NOT NULL,
        min_lat REAL NOT NULL,
        max_lng REAL NOT NULL,
        max_lat REAL NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_offline_roads_bbox
        ON offline_roads(min_lng, max_lng, min_lat, max_lat);

      CREATE VIRTUAL TABLE IF NOT EXISTS offline_fts USING fts5(
        entity_kind UNINDEXED,
        entity_id UNINDEXED,
        name,
        category_name,
        municipality_name,
        road_name,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      CREATE TABLE IF NOT EXISTS offline_outbox (
        request_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        procedure TEXT NOT NULL,
        title TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        observed_at TEXT,
        created_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        blocked INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        error_reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_offline_outbox_user_created
        ON offline_outbox(user_id, created_at ASC);

      PRAGMA user_version = 1;
    `);
  });
}

async function openEncryptedDatabase(): Promise<SQLite.SQLiteDatabase> {
  const hexKey = await resolveDatabaseHexKey();
  if (!HEX_KEY_PATTERN.test(hexKey)) {
    throw new Error("Invalid SQLCipher key format.");
  }

  let db = await SQLite.openDatabaseAsync(OFFLINE_DB_NAME);
  try {
    await db.execAsync(`PRAGMA key = "x'${hexKey}'";`);
    // Force the key check before trusting the file. Schema work stays outside
    // this block so a failed migration can never be mistaken for a bad key and
    // take the queued contributions with it.
    await db.getFirstAsync("SELECT count(*) FROM sqlite_master");
  } catch (error) {
    // The file predates encryption, came from another key, or is corrupt. Its
    // contents are unreadable either way; report it before replacing it so a
    // wiped queue is visible instead of silent.
    reportError(error, "offline-db-open");
    await db.closeAsync().catch(() => undefined);
    await SQLite.deleteDatabaseAsync(OFFLINE_DB_NAME).catch(() => undefined);
    db = await SQLite.openDatabaseAsync(OFFLINE_DB_NAME);
    await db.execAsync(`PRAGMA key = "x'${hexKey}'";`);
  }
  await applySchema(db);
  return db;
}

/** Shared SQLCipher-encrypted database connection for offline content and outbox. */
export function getOfflineDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= openEncryptedDatabase().catch((error: unknown) => {
    dbPromise = undefined;
    throw error;
  });
  return dbPromise;
}

/**
 * Serializes write operations on the shared SQLCipher connection so two callers
 * never overlap `withTransactionAsync` on the same SQLite handle.
 */
export function withOfflineWrite<T>(
  task: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const next = writeChain.then(async () => {
    const db = await getOfflineDb();
    return task(db);
  });
  writeChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
