/**
 * Seeds the reference data the app cannot start empty with.
 *
 * Idempotent: re-running updates rows rather than duplicating them, so it is
 * safe in a deploy step and safe to run again after a demo reset.
 *
 * Municipality boundaries are left null. They come from official shapefiles and
 * are loaded separately; until then the app asks people which municipality they
 * are in rather than pretending to know where the borders run.
 *
 * The places here are a handful of real, publicly known landmarks — enough to
 * prove the tile pipeline end to end. The full provincial dataset is its own
 * task.
 */

import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { categories, municipalities, placePhotos, places } from "@/db/schema";

// Centres and the landmarks below are OpenStreetMap's positions (parque
// central, ayuntamiento, hospital, dam), checked against Nominatim on
// 2026-10-14. The rounded estimates that stood here put Sabaneta's square in
// open country 900 m west of town and the dam 5 km from its wall.
const MUNICIPALITIES = [
  { id: "sabaneta", name: "Sabaneta", center: { x: -71.3418, y: 19.4757 } },
  { id: "moncion", name: "Monción", center: { x: -71.1504, y: 19.4109 } },
  {
    id: "villa-los-almacigos",
    name: "Villa Los Almácigos",
    center: { x: -71.442, y: 19.4088 },
  },
] as const;

const CATEGORIES = [
  {
    id: "balneario",
    kind: "place",
    name: "Balneario",
    icon: "waves",
    color: "#0ea5e9",
    sortOrder: 10,
  },
  {
    id: "salud",
    kind: "place",
    name: "Salud",
    icon: "cross",
    color: "#dc2626",
    sortOrder: 20,
  },
  {
    id: "educacion",
    kind: "place",
    name: "Educación",
    icon: "graduation-cap",
    color: "#7c3aed",
    sortOrder: 30,
  },
  {
    id: "gobierno",
    kind: "place",
    name: "Gobierno",
    icon: "landmark",
    color: "#475569",
    sortOrder: 40,
  },
  {
    id: "parque",
    kind: "place",
    name: "Parque o plaza",
    icon: "trees",
    color: "#16a34a",
    sortOrder: 50,
  },
  {
    id: "transporte",
    kind: "place",
    name: "Transporte",
    icon: "bus",
    color: "#ea580c",
    sortOrder: 60,
  },
  {
    id: "agro",
    kind: "business",
    name: "Agropecuaria",
    icon: "wheat",
    color: "#ca8a04",
    sortOrder: 10,
  },
  {
    id: "colmado",
    kind: "business",
    name: "Colmado",
    icon: "shopping-basket",
    color: "#0d9488",
    sortOrder: 20,
  },
  {
    id: "comedor",
    kind: "business",
    name: "Comedor",
    icon: "utensils",
    color: "#e11d48",
    sortOrder: 30,
  },
  {
    id: "hospedaje",
    kind: "business",
    name: "Hospedaje",
    icon: "bed-double",
    color: "#8b5cf6",
    sortOrder: 40,
  },
  {
    id: "senderismo",
    kind: "route",
    name: "Senderismo",
    icon: "footprints",
    color: "#65a30d",
    sortOrder: 10,
  },
  {
    id: "ciclismo",
    kind: "route",
    name: "Ciclismo",
    icon: "bike",
    color: "#0891b2",
    sortOrder: 20,
  },
  // `severity` is what colours the road on the citizen traffic layer. It is a
  // judgement about this province — water over a road here means turn around —
  // and an official can change it from the admin panel without a deploy.
  {
    id: "via-bloqueada",
    kind: "traffic",
    name: "Vía bloqueada",
    icon: "octagon-x",
    color: "#dc2626",
    severity: "blocking",
    sortOrder: 10,
  },
  {
    id: "hoyo",
    kind: "traffic",
    name: "Hoyo en la vía",
    icon: "triangle-alert",
    color: "#f59e0b",
    severity: "partial",
    sortOrder: 20,
  },
  {
    id: "inundacion",
    kind: "traffic",
    name: "Inundación",
    icon: "cloud-rain",
    color: "#2563eb",
    severity: "blocking",
    sortOrder: 30,
  },
  {
    id: "agua",
    kind: "consultation",
    name: "Agua potable",
    icon: "droplets",
    color: "#0ea5e9",
    sortOrder: 10,
  },
  {
    id: "vias",
    kind: "consultation",
    name: "Calles y caminos",
    icon: "route",
    color: "#78716c",
    sortOrder: 20,
  },
  {
    id: "basura",
    kind: "consultation",
    name: "Basura",
    icon: "trash-2",
    color: "#57534e",
    sortOrder: 30,
  },
  {
    id: "alumbrado",
    kind: "consultation",
    name: "Alumbrado",
    icon: "lightbulb",
    color: "#eab308",
    sortOrder: 40,
  },
] as const;

const PLACES = [
  {
    slug: "presa-de-moncion",
    name: "Presa de Monción",
    description: "La segunda presa más grande del país, sobre el río Mao.",
    address: "Carretera de la Presa, Monción",
    imageUrl: "/places/presa-moncion.webp",
    categoryId: "parque",
    municipalityId: "moncion",
    // 100 m inside Monción: the official boundary runs along the river
    // through the dam wall, and the wall itself sits 2 m outside it.
    location: { x: -71.1197, y: 19.4063 },
  },
  {
    slug: "parque-central-sabaneta",
    name: "Parque Central de Sabaneta",
    description: "Plaza principal del municipio cabecera.",
    address: "Centro de Sabaneta",
    imageUrl: "/places/parque-sabaneta.webp",
    categoryId: "parque",
    municipalityId: "sabaneta",
    location: { x: -71.3418, y: 19.4757 },
  },
  {
    slug: "hospital-municipal-sabaneta",
    name: "Hospital Municipal de Sabaneta",
    description:
      "Centro de atención de salud para Sabaneta y comunidades cercanas.",
    address: "Sabaneta, Santiago Rodríguez",
    imageUrl: "/places/hospital-sabaneta.webp",
    categoryId: "salud",
    municipalityId: "sabaneta",
    location: { x: -71.3417, y: 19.4785 },
  },
  {
    slug: "ayuntamiento-villa-los-almacigos",
    name: "Ayuntamiento de Villa Los Almácigos",
    description:
      "Sede del gobierno municipal y de los servicios del ayuntamiento.",
    address: "Centro de Villa Los Almácigos",
    imageUrl: "/places/ayuntamiento-almacigos.webp",
    categoryId: "gobierno",
    municipalityId: "villa-los-almacigos",
    location: { x: -71.442, y: 19.4088 },
  },
  // Two businesses, so the claim flow has something real to be demonstrated
  // against. A business is a place with a `business` category — there is no
  // separate table — and `business_claims` is what answers "whose is it".
  {
    slug: "colmado-la-esquina-sabaneta",
    name: "Colmado La Esquina",
    description:
      "Colmado de barrio con víveres, bebidas frías y servicio de delivery en motor.",
    address: "Calle Rosa Duarte, Sabaneta",
    imageUrl: null,
    categoryId: "colmado",
    municipalityId: "sabaneta",
    location: { x: -71.3405, y: 19.4831 },
  },
  {
    slug: "comedor-dona-mercedes-moncion",
    name: "Comedor Doña Mercedes",
    description:
      "Comida criolla al mediodía: sancocho los sábados y plato del día toda la semana.",
    address: "Frente al parque, Monción",
    imageUrl: null,
    categoryId: "comedor",
    municipalityId: "moncion",
    location: { x: -71.1497, y: 19.4106 },
  },
  {
    slug: "parada-guaguas-moncion",
    name: "Parada de guaguas de Monción",
    description:
      "Punto de salida del transporte público hacia los municipios cercanos.",
    address: "Centro de Monción",
    imageUrl: "/places/parada-moncion.webp",
    categoryId: "transporte",
    municipalityId: "moncion",
    location: { x: -71.151, y: 19.4113 },
  },
] as const;

/**
 * Photos for the seeded places, so the drawer's photo strip and the viewer
 * have more than one image to show before anybody has uploaded anything.
 *
 * A key here is a public path under `public/`, the same convention
 * `places.imageUrl` uses — nothing is in the bucket to sign. The same file
 * repeats under distinct query strings because the key is unique and the
 * strip only needs several photos, not several photographs. Real photos
 * arrive as object keys the moment a citizen uploads one.
 */
const PLACE_PHOTOS: Record<string, readonly string[]> = {
  "presa-de-moncion": [
    "/places/presa-moncion.webp",
    "/places/presa-moncion.webp?2",
    "/places/presa-moncion.webp?3",
  ],
  "parque-central-sabaneta": [
    "/places/parque-sabaneta.webp",
    "/places/parque-sabaneta.webp?2",
  ],
};

async function main() {
  for (const municipality of MUNICIPALITIES) {
    await db
      .insert(municipalities)
      .values(municipality)
      .onConflictDoUpdate({
        target: municipalities.id,
        set: { name: municipality.name, center: municipality.center },
      });
  }

  for (const category of CATEGORIES) {
    await db
      .insert(categories)
      .values({
        ...category,
        severity: "severity" in category ? category.severity : null,
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: category.name,
          icon: category.icon,
          color: category.color,
          severity: "severity" in category ? category.severity : null,
          sortOrder: category.sortOrder,
        },
      });
  }

  for (const place of PLACES) {
    await db
      .insert(places)
      .values({ ...place, status: "published", publishedAt: new Date() })
      .onConflictDoUpdate({
        target: places.slug,
        set: {
          name: place.name,
          description: place.description,
          address: place.address,
          imageUrl: place.imageUrl,
          location: place.location,
          categoryId: place.categoryId,
        },
      });
  }

  let photoCount = 0;
  for (const [slug, keys] of Object.entries(PLACE_PHOTOS)) {
    const [place] = await db
      .select({ id: places.id })
      .from(places)
      .where(eq(places.slug, slug))
      .limit(1);
    if (!place) continue;

    // Explicit timestamps, spaced a second apart: the strip orders by
    // `createdAt`, and one insert statement would stamp them all alike.
    const base = Date.UTC(2026, 0, 1);
    await db
      .insert(placePhotos)
      .values(
        keys.map((storageKey, index) => ({
          placeId: place.id,
          storageKey,
          status: "published" as const,
          createdAt: new Date(base + index * 1000),
        })),
      )
      .onConflictDoNothing({ target: placePhotos.storageKey });
    photoCount += keys.length;
  }

  console.log(
    `seeded ${MUNICIPALITIES.length} municipalities, ${CATEGORIES.length} categories, ${PLACES.length} places, ${photoCount} photos`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
