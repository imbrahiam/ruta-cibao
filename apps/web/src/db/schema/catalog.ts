import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * How much a traffic category actually costs a driver.
 *
 * The map colours a reported stretch of road by this, the way every traffic
 * layer people have already learned does: red is do not go, amber is go
 * carefully, yellow is worth knowing. Green is not here because it is not a
 * property of a problem — it is what the map says once neighbours have
 * confirmed one is over.
 *
 * A column rather than a list of category ids in the code, because which
 * problems block a road is a judgement about this province, and an official
 * adding "Derrumbe" from the admin panel has to be able to say it blocks
 * without waiting for a deploy.
 *
 * Null for every category that is not a traffic one: a colmado has no severity.
 */
export const trafficSeverity = pgEnum("traffic_severity", [
  "blocking",
  "partial",
  "minor",
]);

/**
 * Which feature a category belongs to.
 *
 * One table rather than five near-identical ones: a category is the same shape
 * everywhere — a name, an icon, a colour, an order — and the differences are in
 * what it is attached to, not in the category itself.
 */
export const categoryKind = pgEnum("category_kind", [
  "place",
  "business",
  "route",
  "traffic",
  "consultation",
]);

/**
 * The taxonomy the municipality manages.
 *
 * Names live here rather than in the message catalogue because an official has
 * to be able to add "Balneario" from the admin panel without waiting for a
 * deploy. That makes them content, and content belongs in the database.
 *
 * Categories are deactivated, never deleted: a place that has been filed under
 * one for a year should not lose its classification because the taxonomy
 * changed.
 */
export const categories = pgTable(
  "categories",
  {
    /** Stable slug used in URLs and filter state: `balneario`, `colmado`. */
    id: text().primaryKey(),
    kind: categoryKind().notNull(),
    name: text().notNull(),
    /** Lucide icon name, so the admin can pick one without touching code. */
    icon: text().notNull().default("map-pin"),
    /** Hex, used for the map marker and the legend chip. */
    color: text().notNull().default("#166534"),
    /** Only meaningful on a `traffic` category; null everywhere else. */
    severity: trafficSeverity(),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("categories_kind_idx").on(table.kind, table.sortOrder),
    uniqueIndex("categories_kind_name_idx").on(table.kind, table.name),
  ],
);

export type Category = typeof categories.$inferSelect;
export type CategoryKind = (typeof categoryKind.enumValues)[number];
export type TrafficSeverity = (typeof trafficSeverity.enumValues)[number];
