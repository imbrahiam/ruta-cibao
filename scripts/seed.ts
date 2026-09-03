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

import { db, pool } from "@/db";
import { categories, municipalities, places } from "@/db/schema";

const MUNICIPALITIES = [
  { id: "sabaneta", name: "Sabaneta", center: { x: -71.3506, y: 19.4833 } },
  { id: "moncion", name: "Monción", center: { x: -71.1442, y: 19.4167 } },
  {
    id: "villa-los-almacigos",
    name: "Villa Los Almácigos",
    center: { x: -71.4167, y: 19.4167 },
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
  {
    id: "via-bloqueada",
    kind: "traffic",
    name: "Vía bloqueada",
    icon: "octagon-x",
    color: "#dc2626",
    sortOrder: 10,
  },
  {
    id: "hoyo",
    kind: "traffic",
    name: "Hoyo en la vía",
    icon: "triangle-alert",
    color: "#f59e0b",
    sortOrder: 20,
  },
  {
    id: "inundacion",
    kind: "traffic",
    name: "Inundación",
    icon: "cloud-rain",
    color: "#2563eb",
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
    categoryId: "parque",
    municipalityId: "moncion",
    location: { x: -71.1508, y: 19.4494 },
  },
  {
    slug: "parque-central-sabaneta",
    name: "Parque Central de Sabaneta",
    description: "Plaza principal del municipio cabecera.",
    categoryId: "parque",
    municipalityId: "sabaneta",
    location: { x: -71.3506, y: 19.4833 },
  },
  {
    slug: "hospital-municipal-sabaneta",
    name: "Hospital Municipal de Sabaneta",
    categoryId: "salud",
    municipalityId: "sabaneta",
    location: { x: -71.3489, y: 19.4851 },
  },
  {
    slug: "ayuntamiento-villa-los-almacigos",
    name: "Ayuntamiento de Villa Los Almácigos",
    categoryId: "gobierno",
    municipalityId: "villa-los-almacigos",
    location: { x: -71.4172, y: 19.4162 },
  },
  {
    slug: "parada-guaguas-moncion",
    name: "Parada de guaguas de Monción",
    categoryId: "transporte",
    municipalityId: "moncion",
    location: { x: -71.1447, y: 19.4171 },
  },
] as const;

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
      .values(category)
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: category.name,
          icon: category.icon,
          color: category.color,
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
          location: place.location,
          categoryId: place.categoryId,
        },
      });
  }

  console.log(
    `seeded ${MUNICIPALITIES.length} municipalities, ${CATEGORIES.length} categories, ${PLACES.length} places`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
