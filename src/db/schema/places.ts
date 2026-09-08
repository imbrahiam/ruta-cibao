import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { EMBEDDING_DIMENSIONS } from "@/lib/ai/config";
import type { BusinessContact } from "@/modules/businesses/contracts";
import { embedding, point } from "../types";
import { user } from "./auth";
import { categories } from "./catalog";
import { municipalities } from "./geography";

/**
 * Where a submission is in the moderation queue.
 *
 * `pending` is the default for anything a citizen adds. The map only ever
 * serves `published`, so a mistake or an abuse attempt is invisible to everyone
 * but its author and the moderators until someone decides otherwise.
 */
export const placeStatus = pgEnum("place_status", [
  "draft",
  "pending",
  "published",
  "rejected",
  "archived",
]);

/**
 * How the coordinate was obtained.
 *
 * `map` is somebody dragging the map to a point, which anyone signed in may do.
 * `gps` is somebody standing there with their phone, which only a cédula-
 * verified citizen may claim — an identified person physically at the place is
 * a stronger claim than a pin dropped from a sofa, and recording which is which
 * is what lets moderation treat them differently.
 */
export const placeLocationSource = pgEnum("place_location_source", [
  "map",
  "gps",
]);

export const placeReportReason = pgEnum("place_report_reason", [
  "incorrect_information",
  "closed",
  "duplicate",
  "wrong_location",
  "other",
]);

export const placeReportStatus = pgEnum("place_report_status", [
  "pending",
  "resolved",
  "dismissed",
]);

/**
 * A point on the citizen map: a river, a clinic, a viewpoint, a colmado.
 *
 * `location` is a real geometry, not a pair of numeric columns. That is what
 * lets "which municipality is this in" be `ST_Contains` rather than a guess,
 * "what is near me" be `ST_DWithin` rather than a bounding box approximation,
 * and the map layer be vector tiles built by `ST_AsMVT` in the database rather
 * than thousands of markers pushed into the DOM.
 */
export const places = pgTable(
  "places",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Stable, human-readable, and what `/lugar/[slug]` is built from. */
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),

    categoryId: text()
      .notNull()
      .references(() => categories.id),
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id),

    location: point().notNull(),
    locationSource: placeLocationSource().notNull().default("map"),
    /** Free text, because rural addresses are directions, not street numbers. */
    address: text(),
    /** Public path for seeded imagery, or an object-storage key after moderation. */
    imageUrl: text(),
    businessDetails: jsonb().$type<BusinessContact>(),

    /**
     * What this place means, as a vector.
     *
     * Null until the backfill reaches it, which is why every search that uses
     * it falls back to trigram matching rather than returning nothing: a place
     * published thirty seconds ago has no embedding yet and still has to be
     * findable.
     */
    embedding: embedding(EMBEDDING_DIMENSIONS)("embedding"),

    status: placeStatus().notNull().default("pending"),
    /** Null for a seeded place; set for anything a person submitted. */
    createdByUserId: text().references(() => user.id, { onDelete: "set null" }),
    reviewedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    /** Shown to the author when a submission is turned down. */
    reviewNote: text(),

    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("places_slug_idx").on(table.slug),
    // The index the tile endpoint lives on: every request is a bounding-box
    // intersection against this column.
    index("places_location_idx").using("gist", table.location),
    // Tiles are always filtered to published rows, and the moderation queue
    // always to one municipality.
    index("places_status_idx").on(table.status, table.municipalityId),
    index("places_category_idx").on(table.categoryId),
    // HNSW rather than IVFFlat: it needs no training pass over existing rows,
    // which matters for a table that starts almost empty and grows one citizen
    // submission at a time.
    index("places_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type Place = typeof places.$inferSelect;
export type PlaceStatus = (typeof placeStatus.enumValues)[number];

/** A correction request about a published place, reviewed by a moderator. */
export const placeReports = pgTable(
  "place_reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    placeId: uuid()
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    reporterUserId: text().references(() => user.id, { onDelete: "set null" }),
    reason: placeReportReason().notNull(),
    details: text(),
    status: placeReportStatus().notNull().default("pending"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("place_reports_place_status_idx").on(table.placeId, table.status),
    index("place_reports_reporter_idx").on(table.reporterUserId),
  ],
);

export type PlaceReport = typeof placeReports.$inferSelect;

/**
 * A place somebody kept.
 *
 * Deliberately not a rating or a "like": there is no count, nothing public, and
 * no ranking derived from it. It is a private list — the clinic you will need
 * again, the river you want to show someone — which is the only version of this
 * that cannot be brigaded, and the only one worth having on a civic map.
 *
 * The row is the fact. Unsaving deletes it rather than flipping a flag, so the
 * table never grows a history of what somebody briefly considered keeping.
 */
export const savedPlaces = pgTable(
  "saved_places",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    placeId: uuid()
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("saved_places_user_place_idx").on(table.userId, table.placeId),
    index("saved_places_user_idx").on(table.userId, table.createdAt),
  ],
);

export type SavedPlace = typeof savedPlaces.$inferSelect;

/**
 * What a neighbour says about a place that is already on the map.
 *
 * One tap, two answers, one row per person — which is the whole design. A
 * five-star rating invites an opinion about quality; this asks the only
 * question a civic map needs answered, and the only one a passer-by can answer
 * honestly: is it still there.
 *
 * The unique index is the mechanism, not a safeguard. Somebody who changes
 * their mind updates their row; nobody accumulates influence by tapping twice.
 */
export const placeVerdict = pgEnum("place_verdict", ["exists", "gone"]);

export const placeConfirmations = pgTable(
  "place_confirmations",
  {
    id: uuid().primaryKey().defaultRandom(),
    placeId: uuid()
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verdict: placeVerdict().notNull(),
    /**
     * The submitter's tier at the time of the vote, frozen.
     *
     * A verified resident vouching for a place is worth more than a visitor
     * doing the same, and recomputing that from the profile later would let
     * yesterday's confirmations change weight when somebody verifies today.
     */
    weight: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("place_confirmations_place_user_idx").on(
      table.placeId,
      table.userId,
    ),
    index("place_confirmations_place_idx").on(table.placeId, table.verdict),
  ],
);

export type PlaceConfirmation = typeof placeConfirmations.$inferSelect;
export type PlaceVerdict = (typeof placeVerdict.enumValues)[number];

/**
 * A photograph of a place, contributed by whoever was standing in front of it.
 *
 * Publishing is decided by who took it, not by a queue: a cédula-verified
 * resident's photo appears immediately, and everybody else's waits for a
 * moderator. That asymmetry is the point of verification — it buys trust that
 * is worth something, and it keeps the queue down to the submissions that
 * actually need a human.
 */
export const placePhotoStatus = pgEnum("place_photo_status", [
  "pending",
  "published",
  "rejected",
]);

export const placePhotos = pgTable(
  "place_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    placeId: uuid()
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    uploadedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    /**
     * The object key in storage. Never a URL — those are signed per request.
     * A seeded photo carries a public path instead, the same way
     * `places.imageUrl` does.
     */
    storageKey: text().notNull(),
    status: placePhotoStatus().notNull().default("pending"),
    reviewedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("place_photos_key_idx").on(table.storageKey),
    index("place_photos_place_idx").on(table.placeId, table.status),
  ],
);

export type PlacePhoto = typeof placePhotos.$inferSelect;
