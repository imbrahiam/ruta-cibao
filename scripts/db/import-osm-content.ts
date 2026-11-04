/**
 * Loads real territorial content (points of interest, civic facilities, and
 * local businesses) for Santiago Rodríguez province into PostGIS.
 *
 * Provenance:
 * OpenStreetMap (OSM) contributors, Open Data Commons Open Database License
 * (ODbL) 1.0. Fetched within the three official municipal boundary polygons
 * (San Ignacio de Sabaneta, Monción, Villa Los Almácigos).
 *
 * Deterministic offline import:
 * Reads committed GeoJSON from `scripts/db/sources/content/santiago-rodriguez-osm-places.geojson`.
 * Stable UUID v5 identifiers are derived from `osm:${osmType}:${osmId}`, ensuring
 * idempotency across re-runs.
 *
 * Safe regarding citizen contributions:
 * Never overwrites places submitted or claimed by app users (checks
 * `createdByUserId IS NULL`).
 *
 * Deduplication against seeded landmarks:
 * If an OSM feature is within ~150 m of a hand-seeded place of the same category
 * and clearly the same place, the seeded row (which contains photography and
 * curated editorial description) is preserved and the OSM duplicate is collapsed.
 *
 * Audit trail:
 * Writes an append-only `audit_events` row per import batch.
 *
 * How to refresh:
 * Run `bun run scripts/db/import-osm-content.ts --refresh` to re-query the Overpass
 * API (with automatic fallback mirrors), re-filter against the database's
 * PostGIS municipal boundaries, write updated snapshots to `scripts/db/sources/content/`,
 * and import them. Review the diff before committing.
 *
 *   bun run scripts/db/import-osm-content.ts
 *   bun run scripts/db/import-osm-content.ts --refresh
 */

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { formatPhone, isCompletePhone } from "@ruta/shared/phone";
import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { auditEvents, categories, municipalities, places } from "@/db/schema";
import { env } from "@/lib/env";

const PLACES_SNAPSHOT = new URL(
  "./sources/content/santiago-rodriguez-osm-places.geojson",
  import.meta.url,
);
const ALL_POIS_SNAPSHOT = new URL(
  "./sources/content/santiago-rodriguez-osm-all-pois.geojson",
  import.meta.url,
);
const UNMAPPED_KINDS_SNAPSHOT = new URL(
  "./sources/content/osm-unmapped-kinds.json",
  import.meta.url,
);

const OVERPASS_MIRRORS = [
  env.OVERPASS_URL,
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
].filter((url, index, all) => Boolean(url) && all.indexOf(url) === index);

export type MappedCategory = {
  categoryId: string;
  categoryKind: "place" | "business";
};

export type OsmFeatureProperties = {
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  categoryId: string | null;
  categoryKind: "place" | "business" | null;
  municipalityId: string;
  municipalityName: string;
  address: string | null;
  phone: string | null;
  openingHours: string | null;
  website: string | null;
  tags: Record<string, string>;
};

export type OsmFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: OsmFeatureProperties;
};

export type OsmFeatureCollection = {
  type: "FeatureCollection";
  provenance: {
    source: string;
    license: string;
    attribution: string;
    retrievedAt: string;
    territory: string;
    municipalities?: string[];
  };
  features: OsmFeature[];
};

export const SEEDED_PLACES = [
  {
    slug: "presa-de-moncion",
    name: "Presa de Monción",
    categoryId: "parque",
    municipalityId: "moncion",
    location: { x: -71.1197, y: 19.4063 },
  },
  {
    slug: "parque-central-sabaneta",
    name: "Parque Central de Sabaneta",
    categoryId: "parque",
    municipalityId: "sabaneta",
    location: { x: -71.3418, y: 19.4757 },
  },
  {
    slug: "hospital-municipal-sabaneta",
    name: "Hospital Municipal de Sabaneta",
    categoryId: "salud",
    municipalityId: "sabaneta",
    location: { x: -71.3417, y: 19.4785 },
  },
  {
    slug: "ayuntamiento-villa-los-almacigos",
    name: "Ayuntamiento de Villa Los Almácigos",
    categoryId: "gobierno",
    municipalityId: "villa-los-almacigos",
    location: { x: -71.442, y: 19.4088 },
  },
  {
    slug: "colmado-la-esquina-sabaneta",
    name: "Colmado La Esquina",
    categoryId: "colmado",
    municipalityId: "sabaneta",
    location: { x: -71.3405, y: 19.4831 },
  },
  {
    slug: "comedor-dona-mercedes-moncion",
    name: "Comedor Doña Mercedes",
    categoryId: "comedor",
    municipalityId: "moncion",
    location: { x: -71.1497, y: 19.4106 },
  },
  {
    slug: "parada-guaguas-moncion",
    name: "Parada de guaguas de Monción",
    categoryId: "transporte",
    municipalityId: "moncion",
    location: { x: -71.151, y: 19.4113 },
  },
] as const;

export function haversineMeters(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isDuplicateOfSeeded(
  name: string,
  categoryId: string,
  coordinates: [number, number],
): {
  isDuplicate: boolean;
  seededSlug?: string;
  seededName?: string;
  distMeters?: number;
} {
  const [lon, lat] = coordinates;
  for (const seeded of SEEDED_PLACES) {
    if (seeded.categoryId === categoryId) {
      const dist = haversineMeters(
        seeded.location.x,
        seeded.location.y,
        lon,
        lat,
      );
      if (dist <= 150) {
        const nameLower = name.toLowerCase();
        if (
          nameLower.includes("presa") ||
          nameLower.includes("parque central") ||
          nameLower.includes("hospital") ||
          nameLower.includes("ayuntamiento") ||
          dist < 50
        ) {
          return {
            isDuplicate: true,
            seededSlug: seeded.slug,
            seededName: seeded.name,
            distMeters: Math.round(dist),
          };
        }
      }
    }
  }
  return { isDuplicate: false };
}

/**
 * Deterministic UUID v5 generator based on standard DNS namespace.
 * Guarantees stable IDs across repeated runs for any OSM element.
 */
export function osmUuid(
  osmType: string,
  osmId: number | string,
): `${string}-${string}-${string}-${string}-${string}` {
  const namespace = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const cleanNamespace = namespace.replace(/-/g, "");
  const namespaceBytes = Buffer.from(cleanNamespace, "hex");
  const nameBytes = Buffer.from(`osm:${osmType}:${osmId}`, "utf8");

  const hash = createHash("sha1")
    .update(Buffer.concat([namespaceBytes, nameBytes]))
    .digest();

  const b6 = hash[6] ?? 0;
  hash[6] = (b6 & 0x0f) | 0x50; // version 5
  const b8 = hash[8] ?? 0;
  hash[8] = (b8 & 0x3f) | 0x80; // variant RFC 4122

  const hex = hash.toString("hex", 0, 16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Fuel retailers operating in the Dominican Republic. */
const FUEL_BRANDS =
  /\b(texaco|shell|esso|isla|sunix|total|puma|gulf|next|ecopetr[oó]leo|uno)\b/i;

/**
 * A name that is only the kind of place ("Cafetería", "Colmado") tells a
 * visitor nothing and cannot be told apart from its neighbours; such features
 * are left out rather than shown as anonymous pins.
 */
const GENERIC_NAMES = new Set(
  [
    "cafeteria",
    "colmado",
    "farmacia",
    "restaurante",
    "comedor",
    "iglesia",
    "escuela",
    "liceo",
    "parque",
    "banca",
    "bar",
    "taller",
    "ferreteria",
    "supermercado",
    "hotel",
  ].map((value) => slugify(value)),
);

/**
 * Maps raw OpenStreetMap tags to taxonomy categories in `categories` table.
 */
export function categorizeOsmTags(
  tags: Record<string, string>,
): MappedCategory | null {
  // Gobierno (place)
  if (
    tags.amenity === "police" ||
    tags.amenity === "fire_station" ||
    tags.amenity === "townhall" ||
    tags.amenity === "courthouse" ||
    tags.amenity === "post_office" ||
    tags.office === "government"
  ) {
    return { categoryId: "gobierno", categoryKind: "place" };
  }

  // Educación (place)
  if (
    tags.amenity === "school" ||
    tags.amenity === "college" ||
    tags.amenity === "university" ||
    tags.amenity === "kindergarten"
  ) {
    return { categoryId: "educacion", categoryKind: "place" };
  }

  // Salud (place)
  if (
    tags.amenity === "hospital" ||
    tags.amenity === "clinic" ||
    tags.amenity === "doctors" ||
    tags.amenity === "dentist"
  ) {
    return { categoryId: "salud", categoryKind: "place" };
  }

  // Parque o plaza (place)
  if (tags.leisure === "park" || tags.waterway === "dam") {
    return { categoryId: "parque", categoryKind: "place" };
  }

  // Transporte (place)
  if (
    tags.highway === "bus_stop" ||
    tags.amenity === "bus_station" ||
    tags.public_transport === "station" ||
    tags.public_transport === "stop_position"
  ) {
    return { categoryId: "transporte", categoryKind: "place" };
  }

  // Deporte (place)
  if (
    tags.leisure === "pitch" ||
    tags.leisure === "stadium" ||
    tags.leisure === "fitness_centre"
  ) {
    return { categoryId: "deporte", categoryKind: "place" };
  }

  // Cultura (place)
  if (
    tags.tourism === "artwork" ||
    tags.historic === "monument" ||
    tags.tourism === "information"
  ) {
    return { categoryId: "cultura", categoryKind: "place" };
  }

  // Religión (place)
  if (tags.amenity === "place_of_worship" || tags.amenity === "monastery") {
    return { categoryId: "religion", categoryKind: "place" };
  }

  // A convenience shop carrying a fuel brand is the forecourt shop of a
  // station that is already mapped on its own; a second pin a few metres away
  // labelled as a colmado misleads more than it helps.
  if (tags.shop === "convenience" && FUEL_BRANDS.test(tags.brand ?? "")) {
    return null;
  }

  // Colmado (business)
  if (
    tags.shop === "supermarket" ||
    tags.shop === "convenience" ||
    tags.shop === "groceries"
  ) {
    return { categoryId: "colmado", categoryKind: "business" };
  }

  // Comedor (business)
  if (
    tags.amenity === "restaurant" ||
    tags.amenity === "fast_food" ||
    tags.amenity === "cafe" ||
    tags.amenity === "ice_cream"
  ) {
    return { categoryId: "comedor", categoryKind: "business" };
  }

  // Hospedaje (business)
  if (
    tags.tourism === "hotel" ||
    tags.tourism === "motel" ||
    tags.tourism === "guest_house" ||
    tags.tourism === "hostel"
  ) {
    return { categoryId: "hospedaje", categoryKind: "business" };
  }

  // Agropecuaria (business)
  if (tags.shop === "agrarian" || tags.shop === "farm") {
    return { categoryId: "agro", categoryKind: "business" };
  }

  // Farmacia (business)
  if (tags.amenity === "pharmacy" || tags.shop === "chemist") {
    return { categoryId: "farmacia", categoryKind: "business" };
  }

  // Combustible (business)
  if (tags.amenity === "fuel") {
    return { categoryId: "combustible", categoryKind: "business" };
  }

  // Banco (business)
  if (tags.amenity === "bank") {
    return { categoryId: "banco", categoryKind: "business" };
  }

  // Ferretería (business)
  if (tags.shop === "hardware") {
    return { categoryId: "ferreteria", categoryKind: "business" };
  }

  // Taller (business)
  if (tags.shop === "car_repair" || tags.shop === "motorcycle_repair") {
    return { categoryId: "taller", categoryKind: "business" };
  }

  // Bar y vida nocturna (business)
  if (
    tags.amenity === "bar" ||
    tags.amenity === "nightclub" ||
    tags.amenity === "pub"
  ) {
    return { categoryId: "bar", categoryKind: "business" };
  }

  return null;
}

type OverpassRawElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function fetchFromOverpass(): Promise<OverpassRawElement[]> {
  const query = `
[out:json][timeout:60];
(
  nwr["amenity"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
  nwr["shop"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
  nwr["tourism"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
  nwr["leisure"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
  nwr["office"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
  nwr["highway"="bus_stop"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
  nwr["historic"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
  nwr["natural"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
  nwr["waterway"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
  nwr["craft"]["name"](19.168386, -71.5196747, 19.5698735, -71.0720076);
);
out center tags;
  `.trim();

  let lastError: Error | null = null;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      console.log(`Connecting to Overpass mirror: ${mirror}...`);
      const response = await fetch(mirror, {
        method: "POST",
        body: query,
        headers: {
          "User-Agent":
            "RutaCibaoContentImport/1.0 (https://github.com/imbrahiam/ruta-cibao)",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Overpass mirror ${mirror} returned HTTP ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        elements?: OverpassRawElement[];
      };
      if (!Array.isArray(data.elements)) {
        throw new Error(`Invalid Overpass response format from ${mirror}`);
      }

      console.log(
        `Successfully retrieved ${data.elements.length} raw elements from ${mirror}`,
      );
      return data.elements;
    } catch (error) {
      console.warn(
        `Mirror ${mirror} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("All Overpass mirrors failed or timed out.");
}

export async function refreshSnapshots(): Promise<void> {
  console.log("Refreshing OSM snapshots from live Overpass API...");
  const rawElements = await fetchFromOverpass();

  const inside: Array<{
    osmType: "node" | "way" | "relation";
    osmId: number;
    name: string;
    tags: Record<string, string>;
    municipalityId: string;
    municipalityName: string;
    coordinates: [number, number];
  }> = [];

  for (const el of rawElements) {
    const lon = el.lon ?? el.center?.lon;
    const lat = el.lat ?? el.center?.lat;
    if (lon == null || lat == null || !el.tags?.name) continue;

    const resMuni = await db.execute<{ id: string; name: string }>(sql`
      SELECT id, name
      FROM municipalities
      WHERE ST_Contains(boundary, ST_SetSRID(ST_Point(${lon}, ${lat}), 4326))
      LIMIT 1;
    `);

    const muni = resMuni.rows[0];
    if (muni) {
      inside.push({
        osmType: el.type,
        osmId: el.id,
        name: el.tags.name.trim(),
        tags: el.tags,
        municipalityId: muni.id,
        municipalityName: muni.name,
        coordinates: [Number(lon.toFixed(7)), Number(lat.toFixed(7))],
      });
    }
  }

  const mappedFeatures: OsmFeature[] = [];
  const allFeatures: OsmFeature[] = [];
  const unmappedKinds: Record<
    string,
    Array<{
      osmType: string;
      osmId: number;
      name: string;
      municipalityId: string;
      coordinates: [number, number];
      tags: Record<string, string>;
    }>
  > = {};

  for (const item of inside) {
    const cat = categorizeOsmTags(item.tags);
    const t = item.tags;

    const rawPhone = t.phone || t["contact:phone"];
    const phone =
      rawPhone && isCompletePhone(rawPhone)
        ? formatPhone(rawPhone)
        : rawPhone || null;
    const openingHours = t.opening_hours || null;
    const website = t.website || t["contact:website"] || null;
    const address = t["addr:street"]
      ? t["addr:housenumber"]
        ? `${t["addr:street"]} #${t["addr:housenumber"]}`
        : t["addr:street"]
      : null;

    const feature: OsmFeature = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: item.coordinates,
      },
      properties: {
        osmType: item.osmType,
        osmId: item.osmId,
        name: item.name,
        categoryId: cat ? cat.categoryId : null,
        categoryKind: cat ? cat.categoryKind : null,
        municipalityId: item.municipalityId,
        municipalityName: item.municipalityName,
        address,
        phone,
        openingHours,
        website,
        tags: item.tags,
      },
    };

    allFeatures.push(feature);
    if (cat) {
      const dupCheck = isDuplicateOfSeeded(
        item.name,
        cat.categoryId,
        item.coordinates,
      );
      if (!dupCheck.isDuplicate) {
        mappedFeatures.push(feature);
      }
    } else {
      const kind = t.amenity
        ? `amenity=${t.amenity}`
        : t.shop
          ? `shop=${t.shop}`
          : t.tourism
            ? `tourism=${t.tourism}`
            : t.leisure
              ? `leisure=${t.leisure}`
              : t.office
                ? `office=${t.office}`
                : t.waterway
                  ? `waterway=${t.waterway}`
                  : t.historic
                    ? `historic=${t.historic}`
                    : "other";

      if (!unmappedKinds[kind]) unmappedKinds[kind] = [];
      unmappedKinds[kind].push({
        osmType: item.osmType,
        osmId: item.osmId,
        name: item.name,
        municipalityId: item.municipalityId,
        coordinates: item.coordinates,
        tags: item.tags,
      });
    }
  }

  mappedFeatures.sort((a, b) => {
    const m = a.properties.municipalityId.localeCompare(
      b.properties.municipalityId,
    );
    if (m !== 0) return m;
    const c = (a.properties.categoryId || "").localeCompare(
      b.properties.categoryId || "",
    );
    if (c !== 0) return c;
    return a.properties.name.localeCompare(b.properties.name);
  });

  allFeatures.sort((a, b) => {
    const m = a.properties.municipalityId.localeCompare(
      b.properties.municipalityId,
    );
    if (m !== 0) return m;
    return a.properties.name.localeCompare(b.properties.name);
  });

  const now = new Date().toISOString();
  const mappedCollection: OsmFeatureCollection = {
    type: "FeatureCollection",
    provenance: {
      source: "OpenStreetMap",
      license: "Open Data Commons Open Database License (ODbL) 1.0",
      attribution: "© OpenStreetMap contributors",
      retrievedAt: now,
      territory: "Provincia Santiago Rodríguez, República Dominicana",
      municipalities: ["sabaneta", "moncion", "villa-los-almacigos"],
    },
    features: mappedFeatures,
  };

  const allCollection: OsmFeatureCollection = {
    type: "FeatureCollection",
    provenance: {
      source: "OpenStreetMap",
      license: "Open Data Commons Open Database License (ODbL) 1.0",
      attribution: "© OpenStreetMap contributors",
      retrievedAt: now,
      territory: "Provincia Santiago Rodríguez, República Dominicana",
    },
    features: allFeatures,
  };

  await mkdir(new URL("./sources/content", import.meta.url), {
    recursive: true,
  });
  await Bun.write(
    PLACES_SNAPSHOT,
    `${JSON.stringify(mappedCollection, null, 2)}\n`,
  );
  await Bun.write(
    ALL_POIS_SNAPSHOT,
    `${JSON.stringify(allCollection, null, 2)}\n`,
  );
  await Bun.write(
    UNMAPPED_KINDS_SNAPSHOT,
    `${JSON.stringify(unmappedKinds, null, 2)}\n`,
  );

  console.log("Wrote updated snapshots under scripts/db/sources/content/.");
}

export type DuplicateCollapse = {
  seededSlug: string;
  seededName: string;
  seededCategory: string;
  osmId: string;
  osmName: string;
  distMeters: number;
};

export async function importOsmContent(): Promise<{
  insertedOrUpdated: number;
  byMunicipality: Record<string, number>;
  byCategory: Record<string, number>;
  collapsedDuplicates: DuplicateCollapse[];
  sampleNames: string[];
}> {
  const file = Bun.file(PLACES_SNAPSHOT);
  if (!(await file.exists())) {
    throw new Error(
      `Snapshot file ${PLACES_SNAPSHOT.pathname} not found. Run with --refresh first.`,
    );
  }

  const collection = (await file.json()) as OsmFeatureCollection;
  console.log(
    `Loading ${collection.features.length} mapped OSM places from snapshot...`,
  );

  // Validate existing categories and municipalities in DB
  const dbMunicipalities = await db
    .select({ id: municipalities.id })
    .from(municipalities);
  const dbCategories = await db.select({ id: categories.id }).from(categories);

  const muniIds = new Set(dbMunicipalities.map((m) => m.id));
  const catIds = new Set(dbCategories.map((c) => c.id));

  const byMunicipality: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const sampleNames: string[] = [];
  const collapsedDuplicates: DuplicateCollapse[] = [];
  const duplicateIdsToDelete: string[] = [];
  let insertedOrUpdated = 0;

  for (const feature of collection.features) {
    const { properties, geometry } = feature;
    const {
      osmType,
      osmId,
      name,
      municipalityId,
      address,
      phone,
      openingHours,
      tags,
    } = properties;

    // The classifier, not the snapshot, decides the category, so a mapping
    // fix applies on the next import without re-querying Overpass. A feature
    // it no longer accepts is removed if an earlier run imported it.
    const categoryId = categorizeOsmTags(tags)?.categoryId ?? null;
    if (
      !categoryId ||
      !catIds.has(categoryId) ||
      GENERIC_NAMES.has(slugify(name))
    ) {
      duplicateIdsToDelete.push(osmUuid(osmType, osmId));
      continue;
    }
    if (!muniIds.has(municipalityId)) {
      continue;
    }

    // Dedupe check against hand-seeded places
    const dupCheck = isDuplicateOfSeeded(
      name,
      categoryId,
      geometry.coordinates,
    );
    if (dupCheck.isDuplicate) {
      collapsedDuplicates.push({
        seededSlug: dupCheck.seededSlug ?? "",
        seededName: dupCheck.seededName ?? "",
        seededCategory: categoryId,
        osmId: `${osmType}/${osmId}`,
        osmName: name,
        distMeters: dupCheck.distMeters ?? 0,
      });
      duplicateIdsToDelete.push(osmUuid(osmType, osmId));
      continue;
    }

    const id = osmUuid(osmType, osmId);
    const baseSlug = slugify(name) || "lugar";
    const slug = `${baseSlug}-${municipalityId}-${osmType.slice(0, 1)}${osmId}`;

    // Contact details for businesses/places
    const businessDetails =
      phone || openingHours
        ? {
            contactPhone: phone || "",
            whatsapp: "",
            openingHours: openingHours || "",
          }
        : null;

    const description = tags.description || null;
    const reviewNote = `OpenStreetMap contributors (ODbL 1.0); osm:${osmType}/${osmId}`;
    const location = { x: geometry.coordinates[0], y: geometry.coordinates[1] };

    // Idempotent upsert: update only if createdByUserId IS NULL
    // (Never overwrites places submitted or edited by citizens/users)
    await db
      .insert(places)
      .values({
        id,
        slug,
        name,
        description,
        categoryId,
        municipalityId,
        location,
        locationSource: "map",
        address,
        businessDetails,
        status: "published",
        publishedAt: new Date(),
        createdByUserId: null,
        reviewNote,
      })
      .onConflictDoUpdate({
        target: places.id,
        set: {
          name,
          slug,
          description,
          categoryId,
          municipalityId,
          location,
          address,
          businessDetails,
          reviewNote,
          updatedAt: new Date(),
        },
        where: sql`${places.createdByUserId} IS NULL`,
      });

    insertedOrUpdated += 1;
    byMunicipality[municipalityId] = (byMunicipality[municipalityId] || 0) + 1;
    byCategory[categoryId] = (byCategory[categoryId] || 0) + 1;

    if (sampleNames.length < 15) {
      sampleNames.push(`${name} (${municipalityId} / ${categoryId})`);
    }
  }

  // Delete any previously imported duplicate rows created by this script
  if (duplicateIdsToDelete.length > 0) {
    await db
      .delete(places)
      .where(
        sql`${places.id} IN ${duplicateIdsToDelete} AND ${places.createdByUserId} IS NULL`,
      );
  }

  // Append-only audit record per import batch
  await db.insert(auditEvents).values({
    actorUserId: null,
    action: "places.osm_imported",
    subjectType: "places_batch",
    subjectId: null,
    municipalityId: null,
    metadata: {
      source: "OpenStreetMap",
      license: "ODbL 1.0",
      count: insertedOrUpdated,
      byMunicipality,
      byCategory,
      collapsedDuplicatesCount: collapsedDuplicates.length,
      snapshotTimestamp: collection.provenance.retrievedAt,
    },
  });

  return {
    insertedOrUpdated,
    byMunicipality,
    byCategory,
    collapsedDuplicates,
    sampleNames,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const shouldRefresh = args.includes("--refresh");

  if (shouldRefresh) {
    await refreshSnapshots();
  }

  console.log("Starting deterministic import into database...");
  const result = await importOsmContent();

  console.log("\n========================================================");
  console.log("Ruta Cibao — Territorial Content Import Complete");
  console.log("========================================================");
  console.log(
    `Total places imported/synchronized: ${result.insertedOrUpdated}`,
  );
  console.log("\nCounts by Municipality:");
  for (const [muni, count] of Object.entries(result.byMunicipality)) {
    console.log(`  - ${muni}: ${count}`);
  }
  console.log("\nCounts by Category:");
  for (const [cat, count] of Object.entries(result.byCategory)) {
    console.log(`  - ${cat}: ${count}`);
  }
  if (result.collapsedDuplicates.length > 0) {
    console.log("\nCollapsed duplicates against hand-seeded places:");
    for (const dup of result.collapsedDuplicates) {
      console.log(
        `  * Collapsed OSM "${dup.osmName}" (${dup.osmId}) into seeded "${dup.seededName}" (${dup.seededSlug}) [~${dup.distMeters} m]`,
      );
    }
  }
  console.log("\nSample imported places:");
  for (const name of result.sampleNames) {
    console.log(`  * ${name}`);
  }
  console.log("========================================================\n");
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error("Import failed:", error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
