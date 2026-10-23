import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { municipalities } from "./geography";

/**
 * How far the weekly report got.
 *
 * `ready` means the figures are computed and the page renders; the PDF is a
 * separate, optional step, because a report whose numbers exist but whose PDF
 * failed to render is still a report somebody can read — and telling them it
 * failed would be a lie about the part that matters.
 */
export const weeklyReportStatus = pgEnum("weekly_report_status", [
  "pending",
  "ready",
  "failed",
]);

/**
 * What the platform did in one municipality in one week.
 *
 * The figures are stored rather than computed on read, and that is the point of
 * the table. A report is a statement about a week that has ended: reading it in
 * November has to give the same numbers it gave in March, even though the rows
 * it was derived from have since been edited, moderated or deleted. A live
 * query would quietly rewrite history every time somebody opened it.
 *
 * One row per municipality per week. There is no province-wide row: the
 * province is the three municipalities, an admin sees all three, and a fourth
 * row that is the sum of the others is a fourth place for the sum to be wrong.
 */
export const weeklyReports = pgTable(
  "weekly_reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id, { onDelete: "cascade" }),

    /** Monday 00:00 local, inclusive. */
    periodStart: timestamp({ withTimezone: true }).notNull(),
    /** The following Monday 00:00, exclusive. */
    periodEnd: timestamp({ withTimezone: true }).notNull(),

    status: weeklyReportStatus().notNull().default("pending"),
    /** The frozen figures. Shape lives in `@/modules/reports/contracts`. */
    metrics: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /** Null until the mandatory PDF step completes; retried by the worker. */
    pdfStorageKey: text(),
    /** Why the run failed, when it did. Never a stack trace. */
    failureReason: text(),

    generatedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // The job is retried and the schedule can fire twice after a restart, so
    // "one report per municipality per week" is a constraint, not a convention.
    uniqueIndex("weekly_reports_period_idx").on(
      table.municipalityId,
      table.periodStart,
    ),
    index("weekly_reports_recent_idx").on(
      table.municipalityId,
      table.periodStart.desc(),
    ),
  ],
);

export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type WeeklyReportStatus = (typeof weeklyReportStatus.enumValues)[number];
