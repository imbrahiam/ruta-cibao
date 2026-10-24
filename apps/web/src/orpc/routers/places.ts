import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  categories,
  municipalities,
  placeConfirmations,
  places,
  savedPlaces,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { geocode, isGeocodingEnabled } from "@/lib/geocode";
import { browsePlaces, listContributions } from "@/modules/places/discover";
import {
  attachPhoto,
  PhotoError,
  placePhotoUrls,
  requestPhotoUpload,
} from "@/modules/places/photos";
import {
  PlaceSubmissionError,
  reportPlace,
  submitPlace,
} from "@/modules/places/submit-place";
import { placeThumbnail, thumbnailSelection } from "@/modules/places/thumbnail";
import {
  ConfirmationError,
  confirmPlace,
  placeTrust,
} from "@/modules/places/trust";
import { notBlockedAuthor } from "@/modules/safety/blocks";
import { impl, member } from "../base";

function asPhotoError(error: unknown): never {
  if (error instanceof PhotoError) {
    throw new ORPCError(
      error.reason === "not_found"
        ? "NOT_FOUND"
        : error.reason === "conflict"
          ? "CONFLICT"
          : "BAD_REQUEST",
      {
        message: "That photo cannot be accepted.",
        data: { reason: error.reason },
      },
    );
  }
  throw error;
}

export const placesRouter = {
  browse: impl.places.browse.handler(async ({ context, input }) =>
    browsePlaces(await context.getViewer(), input),
  ),

  contributions: impl.places.contributions
    .use(member)
    .handler(({ context }) => listContributions(context.viewer.userId)),
  /**
   * One place, by slug.
   *
   * Public and limited to published rows: a pending submission is visible to
   * its author and the moderators through the review screens, not through a
   * guessable URL.
   */
  detail: impl.places.detail.handler(async ({ context, input }) => {
    const viewer = await context.getViewer();
    const [row] = await context.db
      .select({
        id: places.id,
        slug: places.slug,
        name: places.name,
        description: places.description,
        address: places.address,
        imageUrl: places.imageUrl,
        ...thumbnailSelection,
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
      .where(
        and(
          eq(places.slug, input.slug),
          eq(places.status, "published"),
          // Somebody the viewer blocked wrote it: it reads as missing.
          notBlockedAuthor(places.createdByUserId, viewer),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ORPCError("NOT_FOUND", {
        message: "That place does not exist.",
      });
    }

    const [photos, trust, mine] = await Promise.all([
      placePhotoUrls(context.db, viewer, row.id),
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
      ...(await placeThumbnail(row)),
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
  nearby: impl.places.nearby.handler(async ({ context, input }) => {
    const viewer = await context.getViewer();
    const origin = sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography`;

    const rows = await context.db
      .select({
        id: places.id,
        ...thumbnailSelection,
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
          notBlockedAuthor(places.createdByUserId, viewer),
          sql`ST_DWithin(${places.location}::geography, ${origin}, ${input.radiusMeters})`,
        ),
      )
      .orderBy(sql`ST_Distance(${places.location}::geography, ${origin})`)
      .limit(input.limit);
    return Promise.all(
      rows.map(async ({ id, appThumbnailKey, googlePlaceId, ...row }) => ({
        ...row,
        ...(await placeThumbnail({ id, appThumbnailKey, googlePlaceId })),
      })),
    );
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
  search: impl.places.search.handler(async ({ context, input }) => {
    const viewer = await context.getViewer();
    const term = input.query.trim();
    const normalised = sql`unaccent(lower(${term}))`;
    const target = sql`unaccent(lower(${places.name}))`;
    const categoryTarget = sql`unaccent(lower(${categories.name}))`;

    const [matched, addresses] = await Promise.all([
      context.db
        .select({
          id: places.id,
          ...thumbnailSelection,
          slug: places.slug,
          name: places.name,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          color: categories.color,
          municipalityName: municipalities.name,
          location: places.location,
        })
        .from(places)
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
        .where(
          and(
            eq(places.status, "published"),
            notBlockedAuthor(places.createdByUserId, viewer),
            // The category too: someone looking for care types "salud"
            // or "clínica", not the hospital's name, and a resident who
            // wants lunch types "comedor".
            sql`(${target} like ${normalised} || '%' or word_similarity(${normalised}, ${target}) > 0.45 or ${categoryTarget} like ${normalised} || '%')`,
          ),
        )
        // Name prefix first, then fuzzy name matches by closeness, then
        // places that only matched by category.
        .orderBy(
          sql`(${target} like ${normalised} || '%') desc`,
          sql`word_similarity(${normalised}, ${target}) desc`,
        )
        .limit(8),

      input.addresses ? geocode(term, 5) : Promise.resolve([]),
    ]);

    return {
      geocoder: isGeocodingEnabled(),
      places: await Promise.all(
        matched.map(async (row) => ({
          ...(await placeThumbnail(row)),
          slug: row.slug,
          name: row.name,
          categoryName: row.categoryName,
          categoryIcon: row.categoryIcon,
          color: row.color,
          municipalityName: row.municipalityName,
          lng: row.location.x,
          lat: row.location.y,
        })),
      ),
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
  saved: impl.places.saved.use(member).handler(async ({ context }) => {
    const rows = await context.db
      .select({
        id: places.id,
        slug: places.slug,
        name: places.name,
        ...thumbnailSelection,
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
          notBlockedAuthor(places.createdByUserId, context.viewer),
        ),
      )
      .orderBy(desc(savedPlaces.createdAt));

    return Promise.all(
      rows.map(async (row) => ({
        ...(await placeThumbnail(row)),
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
      })),
    );
  }),

  /**
   * Keeps a place, or stops keeping it.
   *
   * One procedure rather than a save and an unsave, because the button is one
   * button: the caller says what the end state should be and the server makes
   * that true however many times it is asked. A double tap on a slow connection
   * lands somewhere sensible instead of toggling twice.
   */
  toggleSaved: impl.places.toggleSaved
    .use(member)
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
   * A member procedure: anybody with a verified contact who walked past a
   * closed restaurant knows something worth recording. Every verified account
   * weighs the same.
   */
  confirm: impl.places.confirm.use(member).handler(({ context, input }) =>
    confirmPlace(context.db, context.viewer, input).catch((error: unknown) => {
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
    }),
  ),

  /** A URL the browser may PUT one photo to, and nothing else. */
  photoUpload: impl.places.photoUpload
    .use(member)
    .handler(({ context, input }) =>
      requestPhotoUpload(context.db, context.viewer, input).catch(asPhotoError),
    ),

  /** Tells the app about a photo that finished uploading. */
  attachPhoto: impl.places.attachPhoto
    .use(member)
    .handler(({ context, input }) =>
      attachPhoto(context.db, context.viewer, input).catch(asPhotoError),
    ),

  /** The active taxonomy, for the layer filter chips. */
  categories: impl.places.categories.handler(({ context }) =>
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

  submit: impl.places.submit.use(member).handler(async ({ context, input }) => {
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

  report: impl.places.report.use(member).handler(async ({ context, input }) => {
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
