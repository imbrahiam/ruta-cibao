import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { lineString, point } from "../types";
import { user } from "./auth";
import { categories } from "./catalog";
import { municipalities } from "./geography";
import { publicationStatus } from "./safety";

/**
 * Where a traffic report is in its short life.
 *
 * There is no `pending`. A road is blocked *now*, and a report that waits for a
 * moderator is a report that arrives after the driver already turned onto the
 * road. So it publishes on the spot and the map is honest about how much that
 * is worth: the drawer says who reported it and how long ago, neighbours
 * confirm or contradict it, and it disappears on its own.
 *
 * `cleared` is the community saying it is over, `expired` is time saying so,
 * and `removed` is a moderator saying it should never have been there. Keeping
 * them apart is what lets the map show "ya pasó" differently from "no era
 * cierto", and what gives the audit trail something to answer with.
 */
export const trafficReportStatus = pgEnum("traffic_report_status", [
  "active",
  "cleared",
  "expired",
  "removed",
]);

/** One person's answer to "is it still there". */
export const trafficVerdict = pgEnum("traffic_verdict", ["still", "cleared"]);

/**
 * How long a report stands before it lapses.
 *
 * Six hours because that is roughly the half-life of the things people report —
 * a protest, a fallen tree, water over the road — and because a report nobody
 * has confirmed in six hours has stopped being information. A "sigue ahí" push
 * the window forward, so a hole that really is still there stays on the map for
 * as long as neighbours keep saying so, without anybody having to guess a
 * different lifetime per category.
 */
export const TRAFFIC_REPORT_TTL_MINUTES = 6 * 60;

/**
 * Something on the road, reported by whoever is standing in front of it.
 *
 * A visitor may file one. That is deliberate and it is in the tier matrix: a
 * tourist stuck behind a landslide on the road to Monción knows something every
 * resident on the other side needs, and asking them for a cédula first would
 * throw that away. What a cédula buys is weight when the report is contested,
 * not permission to speak.
 */
export const trafficReports = pgTable(
  "traffic_reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** A `traffic` category: vía bloqueada, hoyo, inundación. */
    categoryId: text()
      .notNull()
      .references(() => categories.id),
    /** Read from the geometry, never from a select on the form. */
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id),
    /**
     * One point that stands for the report.
     *
     * Always present, even when the report is a stretch, in which case it is
     * the middle of it. Everything that asks "where is this" — the marker, the
     * proximity fan-out, the municipality lookup — wants a single coordinate,
     * and deriving one per query from a line is both slower and a second place
     * for the answer to differ.
     */
    location: point().notNull(),
    /**
     * The stretch of road, when the report is one.
     *
     * Null for a point report, which is most of them: a hole is somewhere, a
     * flood is somewhere *along*. Snapped to the road network on the way in, so
     * what is stored follows the street rather than cutting across the blocks
     * between the two ends somebody tapped.
     */
    path: lineString(),
    /** Optional: the category already says most of it. */
    description: text(),
    /**
     * The category, location and freshness publish at once; the free text waits
     * here. Other people see `description` only once it is `published`.
     */
    descriptionModerationStatus: publicationStatus()
      .notNull()
      .default("pending"),

    /** Null for a seeded or orphaned report; the trail survives the account. */
    reportedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),

    status: trafficReportStatus().notNull().default("active"),
    /**
     * When this stops being shown.
     *
     * A column rather than a computed age, because confirmations move it and a
     * report that neighbours keep vouching for should outlive the default.
     */
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Who ended it — a moderator, or the last neighbour who said it was over. */
    resolvedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp({ withTimezone: true }),
    /** Shown to the reporter when a moderator takes one down. */
    reviewNote: text(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // The map asks "what is active near here" on every pan, and the expiry job
    // asks "what is active and past its date" on every run. Both live here.
    index("traffic_reports_location_idx").using("gist", table.location),
    index("traffic_reports_active_idx").on(table.status, table.expiresAt),
    index("traffic_reports_municipality_idx").on(
      table.municipalityId,
      table.status,
    ),
    index("traffic_reports_reporter_idx").on(table.reportedByUserId),
  ],
);

export type TrafficReport = typeof trafficReports.$inferSelect;
export type TrafficReportStatus =
  (typeof trafficReportStatus.enumValues)[number];

/**
 * What a neighbour says about a report that is already on the map.
 *
 * The same shape as `place_confirmations` and for the same reason: one row per
 * person, enforced by the index rather than by whichever code path runs first,
 * so nobody accumulates influence by tapping twice. Changing your mind updates
 * the row.
 *
 * The weight is frozen at vote time. A verified resident's word counts double,
 * and recomputing that later would let today's verification change the meaning
 * of yesterday's vote.
 */
export const trafficConfirmations = pgTable(
  "traffic_confirmations",
  {
    id: uuid().primaryKey().defaultRandom(),
    reportId: uuid()
      .notNull()
      .references(() => trafficReports.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verdict: trafficVerdict().notNull(),
    weight: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("traffic_confirmations_report_user_idx").on(
      table.reportId,
      table.userId,
    ),
    index("traffic_confirmations_report_idx").on(table.reportId, table.verdict),
  ],
);

export type TrafficConfirmation = typeof trafficConfirmations.$inferSelect;
export type TrafficVerdict = (typeof trafficVerdict.enumValues)[number];
