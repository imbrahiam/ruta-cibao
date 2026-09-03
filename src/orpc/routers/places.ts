import { openapi } from "@orpc/openapi";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { categories, municipalities, places } from "@/db/schema";
import { geocode } from "@/lib/geocode";
import { pub } from "../base";

const placeDetail = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  location: z.object({ lng: z.number(), lat: z.number() }),
  category: z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
  }),
  municipality: z.object({ id: z.string(), name: z.string() }),
});

export const placesRouter = {
  /**
   * One place, by slug.
   *
   * Public and limited to published rows: a pending submission is visible to
   * its author and the moderators through the review screens, not through a
   * guessable URL.
   */
  detail: pub
    .meta(
      openapi({
        method: "GET",
        path: "/places/{slug}",
        summary: "A single place",
      }),
    )
    .input(z.object({ slug: z.string().min(1) }))
    .output(placeDetail)
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .select({
          id: places.id,
          slug: places.slug,
          name: places.name,
          description: places.description,
          address: places.address,
          location: places.location,
          categoryId: categories.id,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          municipalityId: municipalities.id,
          municipalityName: municipalities.name,
        })
        .from(places)
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
        .where(and(eq(places.slug, input.slug), eq(places.status, "published")))
        .limit(1);

      if (!row) {
        throw new ORPCError("NOT_FOUND", {
          message: "That place does not exist.",
        });
      }

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        address: row.address,
        location: { lng: row.location.x, lat: row.location.y },
        category: {
          id: row.categoryId,
          name: row.categoryName,
          icon: row.categoryIcon,
          color: row.categoryColor,
        },
        municipality: { id: row.municipalityId, name: row.municipalityName },
      };
    }),

  /**
   * What is close to a point, nearest first.
   *
   * `ST_DWithin` on the geography type measures in metres and uses the spatial
   * index; the alternative — pulling rows and comparing in TypeScript — reads
   * the whole table to answer a question about a few hundred metres.
   */
  nearby: pub
    .meta(
      openapi({
        method: "GET",
        path: "/places/nearby",
        summary: "Places near a point",
      }),
    )
    .input(
      z.object({
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
        radiusMeters: z.number().int().min(50).max(20_000).default(2_000),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .output(
      z.array(
        z.object({
          slug: z.string(),
          name: z.string(),
          distanceMeters: z.number(),
          category: z.object({
            name: z.string(),
            icon: z.string(),
            color: z.string(),
          }),
        }),
      ),
    )
    .handler(async ({ context, input }) => {
      const origin = sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography`;

      return context.db
        .select({
          slug: places.slug,
          name: places.name,
          distanceMeters: sql<number>`round(ST_Distance(${places.location}::geography, ${origin}))::int`,
          category: {
            name: categories.name,
            icon: categories.icon,
            color: categories.color,
          },
        })
        .from(places)
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .where(
          and(
            eq(places.status, "published"),
            sql`ST_DWithin(${places.location}::geography, ${origin}, ${input.radiusMeters})`,
          ),
        )
        .orderBy(sql`ST_Distance(${places.location}::geography, ${origin})`)
        .limit(input.limit);
    }),

  /**
   * Search, over two sources at once.
   *
   * The province's own places come first and always: they are what citizens
   * look for, and they are the half that works with no external service and no
   * network beyond this server. Addresses from the geocoder are appended, and
   * their absence is not an error.
   *
   * Matching is trigram-based over an unaccented copy of the name, because
   * people type "moncion" and "hospitl" and mean the obvious thing.
   *
   * `word_similarity` rather than `similarity`: the latter compares whole
   * strings, so "hospitl" against "Hospital Municipal de Sabaneta" scores 0.188
   * — below any useful threshold — purely because one is much longer than the
   * other. `word_similarity` scores the query against the best-matching run of
   * words inside the name, and the same pair scores 0.750.
   *
   * A prefix match still wins: someone who typed the whole word should see it
   * first, however close a fuzzy match on something else happens to be.
   */
  search: pub
    .meta(
      openapi({
        method: "GET",
        path: "/places/search",
        summary: "Search places and addresses",
      }),
    )
    .input(z.object({ query: z.string().min(2).max(120) }))
    .output(
      z.object({
        places: z.array(
          z.object({
            slug: z.string(),
            name: z.string(),
            categoryName: z.string(),
            color: z.string(),
            municipalityName: z.string(),
            lng: z.number(),
            lat: z.number(),
          }),
        ),
        addresses: z.array(
          z.object({
            name: z.string(),
            context: z.string().nullable(),
            lng: z.number(),
            lat: z.number(),
          }),
        ),
      }),
    )
    .handler(async ({ context, input }) => {
      const term = input.query.trim();
      const normalised = sql`unaccent(lower(${term}))`;
      const target = sql`unaccent(lower(${places.name}))`;

      const [matched, addresses] = await Promise.all([
        context.db
          .select({
            slug: places.slug,
            name: places.name,
            categoryName: categories.name,
            color: categories.color,
            municipalityName: municipalities.name,
            location: places.location,
          })
          .from(places)
          .innerJoin(categories, eq(categories.id, places.categoryId))
          .innerJoin(
            municipalities,
            eq(municipalities.id, places.municipalityId),
          )
          .where(
            and(
              eq(places.status, "published"),
              sql`(${target} like ${normalised} || '%' or word_similarity(${normalised}, ${target}) > 0.45)`,
            ),
          )
          // Prefix matches ahead of fuzzy ones, then by how close the fuzzy is.
          .orderBy(
            sql`(${target} like ${normalised} || '%') desc`,
            sql`word_similarity(${normalised}, ${target}) desc`,
          )
          .limit(8),

        geocode(term, 5),
      ]);

      return {
        places: matched.map((row) => ({
          slug: row.slug,
          name: row.name,
          categoryName: row.categoryName,
          color: row.color,
          municipalityName: row.municipalityName,
          lng: row.location.x,
          lat: row.location.y,
        })),
        addresses,
      };
    }),

  /** The active taxonomy, for the layer filter chips. */
  categories: pub
    .meta(
      openapi({
        method: "GET",
        path: "/places/categories",
        summary: "Place categories",
      }),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          icon: z.string(),
          color: z.string(),
        }),
      ),
    )
    .handler(({ context }) =>
      context.db
        .select({
          id: categories.id,
          name: categories.name,
          icon: categories.icon,
          color: categories.color,
        })
        .from(categories)
        .where(and(eq(categories.kind, "place"), eq(categories.isActive, true)))
        .orderBy(categories.sortOrder),
    ),
};
