import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { lineString, multiPolygon, point } from "../types";

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

/**
 * The province's road network, held locally.
 *
 * A traffic report can cover the street it is on, which means something has to
 * know the shape of that street. Nothing Google sells does: Roads snaps points
 * *to* the network without returning what they landed on, Directions routes
 * *between* two points, and Places returns businesses. OpenStreetMap is the
 * only source that hands back the way itself — so the geometry is OSM's, and
 * the only question was where to ask for it.
 *
 * Asking Overpass per request was the wrong answer, and it failed exactly the
 * way a public service does: fine in testing, then a connection-level block
 * once the crosshair had made a few dozen lookups. Every one of those then
 * surfaced to a citizen as "aquí no encontramos una calle" — the map blaming
 * the road for a rate limit.
 *
 * So the network is imported once and lives here. Three municipalities of roads
 * is a small table, it answers in single-digit milliseconds with no network at
 * all, and it works during the outage that took the previous version down.
 * Roads are redrawn by public works, not by traffic; `bun run db:roads`
 * re-imports when that happens.
 */
export const roads = pgTable(
  "roads",
  {
    /** The OSM way id, so a re-import updates rather than duplicates. */
    id: text().primaryKey(),
    name: text(),
    /** The OSM `highway` tag: `residential`, `track`, `primary`. */
    kind: text().notNull(),
    path: lineString().notNull(),
    importedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Every lookup is "the nearest road to this point", which is this index
    // and nothing else.
    index("roads_path_idx").using("gist", table.path),
  ],
);

export type Road = typeof roads.$inferSelect;
