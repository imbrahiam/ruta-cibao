import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { point } from "../types";
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
    /** Free text, because rural addresses are directions, not street numbers. */
    address: text(),

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
  ],
);

export type Place = typeof places.$inferSelect;
export type PlaceStatus = (typeof placeStatus.enumValues)[number];
