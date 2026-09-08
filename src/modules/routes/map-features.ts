import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { categories, consultations, ecoRoutes } from "@/db/schema";

export const mapFeaturesInput = z
  .object({
    west: z.number().min(-180).max(180),
    east: z.number().min(-180).max(180),
    south: z.number().min(-90).max(90),
    north: z.number().min(-90).max(90),
  })
  .refine((box) => box.west < box.east && box.south < box.north);
export const communityFeature = z.object({
  id: z.string(),
  kind: z.enum(["route", "consultation"]),
  title: z.string(),
  color: z.string(),
  lng: z.number(),
  lat: z.number(),
  path: z.array(z.object({ lng: z.number(), lat: z.number() })).nullable(),
  href: z.string(),
});
export type CommunityFeature = z.infer<typeof communityFeature>;

export async function mapFeatures(
  db: Db,
  bounds: z.infer<typeof mapFeaturesInput>,
) {
  const box = sql`ST_MakeEnvelope(${bounds.west}, ${bounds.south}, ${bounds.east}, ${bounds.north}, 4326)`;
  const [routes, cases] = await Promise.all([
    db
      .select({
        id: ecoRoutes.id,
        name: ecoRoutes.name,
        path: ecoRoutes.path,
        color: categories.color,
      })
      .from(ecoRoutes)
      .innerJoin(categories, eq(categories.id, ecoRoutes.categoryId))
      .where(
        and(
          eq(ecoRoutes.status, "published"),
          sql`${ecoRoutes.path} && ${box}`,
        ),
      )
      .orderBy(ecoRoutes.createdAt, ecoRoutes.id)
      .limit(501),
    db
      .select({
        id: consultations.id,
        slug: consultations.slug,
        title: consultations.title,
        location: consultations.location,
        color: categories.color,
      })
      .from(consultations)
      .innerJoin(categories, eq(categories.id, consultations.categoryId))
      .where(
        and(
          sql`${consultations.location} && ${box}`,
          sql`${consultations.status} not in ('rejected', 'resolved')`,
        ),
      )
      .orderBy(consultations.createdAt, consultations.id)
      .limit(501),
  ]);
  const features: CommunityFeature[] = [];
  for (const route of routes.slice(0, 500)) {
    const first = route.path[0];
    if (first)
      features.push({
        id: route.id,
        kind: "route",
        title: route.name,
        color: route.color,
        lng: first.x,
        lat: first.y,
        path: route.path.map(({ x, y }) => ({ lng: x, lat: y })),
        href: `/rutas?ruta=${route.id}`,
      });
  }
  for (const item of cases.slice(0, 500)) {
    if (item.location)
      features.push({
        id: item.slug,
        kind: "consultation",
        title: item.title,
        color: item.color,
        lng: item.location.x,
        lat: item.location.y,
        path: null,
        href: `/consultas/${item.slug}`,
      });
  }
  return { features, truncated: routes.length > 500 || cases.length > 500 };
}
