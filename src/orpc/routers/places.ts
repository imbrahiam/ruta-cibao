import { openapi } from "@orpc/openapi";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  categories,
  municipalities,
  placeConfirmations,
  places,
  savedPlaces,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { geocode } from "@/lib/geocode";
import {
  browsePlacesInput,
  browsePlacesOutput,
  contributionsOutput,
  reportPlaceInput,
  reportPlaceOutput,
  submitPlaceInput,
  submitPlaceOutput,
} from "@/modules/places/contracts";
import { browsePlaces, listContributions } from "@/modules/places/discover";
import {
  attachPhoto,
  MAX_PHOTO_BYTES,
  PhotoError,
  placePhotoUrls,
  requestPhotoUpload,
} from "@/modules/places/photos";
import {
  PlaceSubmissionError,
  reportPlace,
  submitPlace,
} from "@/modules/places/submit-place";
import {
  ConfirmationError,
  confirmPlace,
  placeTrust,
} from "@/modules/places/trust";
import { memberProcedure, pub } from "../base";

function asPhotoError(error: unknown): never {
  if (error instanceof PhotoError) {
    throw new ORPCError(
      error.reason === "not_found" ? "NOT_FOUND" : "BAD_REQUEST",
      {
        message: "That photo cannot be accepted.",
        data: { reason: error.reason },
      },
    );
  }
  throw error;
}

const placeDetail = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  imageUrl: z.string().nullable(),
  location: z.object({ lng: z.number(), lat: z.number() }),
  category: z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    color: z.string(),
  }),
  municipality: z.object({ id: z.string(), name: z.string() }),
  photos: z.array(z.string()),
  /**
   * How much the map can vouch for this place, and why.
   *
   * Sent with the detail rather than fetched separately: it changes the first
   * sentence a reader forms about the place, so it cannot arrive afterwards.
   */
  trust: z.object({
    state: z.enum(["new", "confirmed", "doubted", "established"]),
    confirmations: z.number(),
    doubts: z.number(),
    ageDays: z.number().nullable(),
  }),
  /** What the caller already answered, so the prompt is not asked twice. */
  myVerdict: z.enum(["exists", "gone"]).nullable(),
  /** Vouching for your own submission is not evidence. */
  isMine: z.boolean(),
});

export const placesRouter = {
  browse: pub
    .meta(
      openapi({
        method: "GET",
        path: "/places",
        summary: "Browse published places",
      }),
    )
    .input(browsePlacesInput)
    .output(browsePlacesOutput)
    .handler(({ input }) => browsePlaces(input)),

  contributions: memberProcedure
    .meta(
      openapi({
        method: "GET",
        path: "/me/contributions",
        summary: "The caller's submissions and review decisions",
      }),
    )
    .output(contributionsOutput)
    .handler(({ context }) => listContributions(context.viewer.userId)),
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
          imageUrl: places.imageUrl,
          location: places.location,
          categoryId: categories.id,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          municipalityId: municipalities.id,
          municipalityName: municipalities.name,
          publishedAt: places.publishedAt,
          createdByUserId: places.createdByUserId,
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

      const viewer = await context.getViewer();
      const [photos, trust, mine] = await Promise.all([
        placePhotoUrls(context.db, row.id),
        placeTrust(context.db, row.id, row.publishedAt),
        viewer.kind === "anonymous"
          ? Promise.resolve([])
          : context.db
              .select({ verdict: placeConfirmations.verdict })
              .from(placeConfirmations)
              .where(
                and(
                  eq(placeConfirmations.placeId, row.id),
                  eq(placeConfirmations.userId, viewer.userId),
                ),
              )
              .limit(1),
      ]);

      return {
        photos,
        trust,
        myVerdict: mine[0]?.verdict ?? null,
        isMine:
          viewer.kind !== "anonymous" && row.createdByUserId === viewer.userId,
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        address: row.address,
        imageUrl: row.imageUrl,
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

  /**
   * The places this person kept.
   *
   * Private by construction: the query is scoped to the caller's own rows and
   * there is no procedure that counts or lists anybody else's, so a saved place
   * can never become a popularity signal.
   */
  saved: memberProcedure
    .meta(
      openapi({
        method: "GET",
        path: "/places/saved",
        summary: "Places the caller kept",
      }),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          slug: z.string(),
          name: z.string(),
          categoryId: z.string(),
          categoryName: z.string(),
          color: z.string(),
          icon: z.string(),
          municipalityName: z.string(),
          lng: z.number(),
          lat: z.number(),
        }),
      ),
    )
    .handler(async ({ context }) => {
      const rows = await context.db
        .select({
          id: places.id,
          slug: places.slug,
          name: places.name,
          location: places.location,
          categoryId: categories.id,
          categoryName: categories.name,
          color: categories.color,
          icon: categories.icon,
          municipalityName: municipalities.name,
        })
        .from(savedPlaces)
        .innerJoin(places, eq(places.id, savedPlaces.placeId))
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
        .where(
          and(
            eq(savedPlaces.userId, context.viewer.userId),
            // A place pulled from the map should leave the list too, rather
            // than sitting there as a link to a page that will not open.
            eq(places.status, "published"),
          ),
        )
        .orderBy(desc(savedPlaces.createdAt));

      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        color: row.color,
        icon: row.icon,
        municipalityName: row.municipalityName,
        lng: row.location.x,
        lat: row.location.y,
      }));
    }),

  /**
   * Keeps a place, or stops keeping it.
   *
   * One procedure rather than a save and an unsave, because the button is one
   * button: the caller says what the end state should be and the server makes
   * that true however many times it is asked. A double tap on a slow connection
   * lands somewhere sensible instead of toggling twice.
   */
  toggleSaved: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/saved",
        summary: "Keep or release a place",
      }),
    )
    .input(z.object({ placeId: z.uuid(), saved: z.boolean() }))
    .output(z.object({ saved: z.boolean() }))
    .handler(async ({ context, input }) => {
      if (!input.saved) {
        await context.db.transaction(async (tx) => {
          await tx
            .delete(savedPlaces)
            .where(
              and(
                eq(savedPlaces.userId, context.viewer.userId),
                eq(savedPlaces.placeId, input.placeId),
              ),
            );
          await recordAudit(
            {
              actorUserId: context.viewer.userId,
              action: "place.unsaved",
              subjectType: "place",
              subjectId: input.placeId,
            },
            tx,
          );
        });
        return { saved: false };
      }

      const [place] = await context.db
        .select({ id: places.id })
        .from(places)
        .where(
          and(eq(places.id, input.placeId), eq(places.status, "published")),
        )
        .limit(1);

      if (!place) {
        throw new ORPCError("NOT_FOUND", {
          message: "That place does not exist.",
        });
      }

      await context.db.transaction(async (tx) => {
        await tx
          .insert(savedPlaces)
          .values({ userId: context.viewer.userId, placeId: input.placeId })
          .onConflictDoNothing();
        await recordAudit(
          {
            actorUserId: context.viewer.userId,
            action: "place.saved",
            subjectType: "place",
            subjectId: input.placeId,
          },
          tx,
        );
      });

      return { saved: true };
    }),

  /**
   * One neighbour's answer to "is it still there".
   *
   * A member procedure rather than a citizen one: a tourist who walked past a
   * closed restaurant knows something worth recording. Their word simply
   * carries half the weight of a verified resident's.
   */
  confirm: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/confirm",
        summary: "Confirm a place is still there, or is not",
      }),
    )
    .input(z.object({ placeId: z.uuid(), verdict: z.enum(["exists", "gone"]) }))
    .output(
      z.object({
        state: z.enum(["new", "confirmed", "doubted", "established"]),
        confirmations: z.number(),
        doubts: z.number(),
        ageDays: z.number().nullable(),
      }),
    )
    .handler(({ context, input }) =>
      confirmPlace(context.db, context.viewer, input).catch(
        (error: unknown) => {
          if (error instanceof ConfirmationError) {
            throw new ORPCError(
              error.reason === "not_found" ? "NOT_FOUND" : "FORBIDDEN",
              {
                message:
                  error.reason === "not_found"
                    ? "That place does not exist."
                    : "You cannot vouch for your own submission.",
                data: { reason: error.reason },
              },
            );
          }
          throw error;
        },
      ),
    ),

  /** A URL the browser may PUT one photo to, and nothing else. */
  photoUpload: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/photo-upload",
        summary: "Ask for a photo upload URL",
      }),
    )
    .input(
      z.object({
        placeId: z.uuid(),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        sizeBytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
      }),
    )
    .output(z.object({ uploadUrl: z.string(), storageKey: z.string() }))
    .handler(({ context, input }) =>
      requestPhotoUpload(context.db, context.viewer, input).catch(asPhotoError),
    ),

  /** Tells the app about a photo that finished uploading. */
  attachPhoto: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/photos",
        summary: "Record an uploaded photo",
      }),
    )
    .input(z.object({ placeId: z.uuid(), storageKey: z.string().min(1) }))
    .output(z.object({ status: z.enum(["published", "pending"]) }))
    .handler(({ context, input }) =>
      attachPhoto(context.db, context.viewer, input).catch(asPhotoError),
    ),

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
          kind: z.enum(["place", "business"]),
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
          // The WHERE clause below narrows the database enum to these two
          // values; carrying that fact into the selected type keeps the public
          // contract honest without widening it to unrelated taxonomies.
          kind: sql<"place" | "business">`${categories.kind}`,
        })
        .from(categories)
        .where(
          and(
            inArray(categories.kind, ["place", "business"]),
            eq(categories.isActive, true),
          ),
        )
        .orderBy(categories.kind, categories.sortOrder),
    ),

  submit: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/places",
        successStatus: 201,
        summary: "Submit a place for moderation",
      }),
    )
    .input(submitPlaceInput)
    .output(submitPlaceOutput)
    .handler(async ({ context, input }) => {
      try {
        return await submitPlace(context.viewer, input);
      } catch (error) {
        if (error instanceof PlaceSubmissionError) {
          throw new ORPCError("BAD_REQUEST", {
            message: "The place submission is not valid.",
            data: { reason: error.reason },
          });
        }
        throw error;
      }
    }),

  report: memberProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/places/{placeId}/reports",
        successStatus: 201,
        summary: "Report a problem with a place",
      }),
    )
    .input(reportPlaceInput)
    .output(reportPlaceOutput)
    .handler(async ({ context, input }) => {
      try {
        return await reportPlace(context.viewer, input);
      } catch (error) {
        if (
          error instanceof PlaceSubmissionError &&
          error.reason === "not_found"
        ) {
          throw new ORPCError("NOT_FOUND", {
            message: "That published place does not exist.",
          });
        }
        throw error;
      }
    }),
};
