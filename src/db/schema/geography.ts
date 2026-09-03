import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { multiPolygon, point } from "../types";

/**
 * The municipalities of Santiago Rodríguez province.
 *
 * Almost every record in the platform is scoped to one of these: a citizen
 * belongs to one, an official can only moderate their own, and the weekly
 * report is generated per municipality as well as province-wide.
 *
 * Boundaries are real geometries so "which municipality is this point in" is a
 * database question (`ST_Contains`) rather than a guess from a text field.
 */
export const municipalities = pgTable(
  "municipalities",
  {
    /** Stable slug, used in URLs: `sabaneta`, `moncion`, `villa-los-almacigos`. */
    id: text().primaryKey(),
    name: text().notNull(),
    provinceCode: text().notNull().default("SR"),
    /** Filled in from official shapefiles; null until then. */
    boundary: multiPolygon(),
    center: point(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("municipalities_boundary_idx").using("gist", table.boundary),
  ],
);

export type Municipality = typeof municipalities.$inferSelect;
