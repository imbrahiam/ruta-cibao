import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { municipalities } from "./geography";

/**
 * Whether user-written content may be shown to people other than its author and
 * the staff who review it. Used for a consultation as a whole and for the free
 * text of a traffic report, which is held back separately from its category and
 * location so a hazard can warn people at once.
 */
export const publicationStatus = pgEnum("publication_status", [
  "pending",
  "published",
  "hidden",
]);
export type PublicationStatus = (typeof publicationStatus.enumValues)[number];

export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    reporterUserId: text().references(() => user.id, { onDelete: "set null" }),
    subjectKind: text()
      .$type<"place" | "photo" | "route" | "traffic" | "consultation">()
      .notNull(),
    subjectRef: text().notNull(),
    /** Resolved from the content on the server; null for an institutional record. */
    authorUserId: text().references(() => user.id, { onDelete: "set null" }),
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id),
    reason: text()
      .$type<"abuse" | "personal_information" | "unsafe" | "other">()
      .notNull(),
    details: text(),
    status: text()
      .$type<"open" | "actioned" | "dismissed">()
      .notNull()
      .default("open"),
    decisionReason: text(),
    reviewedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("content_reports_queue_idx").on(
      table.status,
      table.municipalityId,
      table.createdAt,
    ),
    index("content_reports_subject_idx").on(
      table.subjectKind,
      table.subjectRef,
    ),
    // One open report per person per subject: repeating it adds nothing for a reviewer.
    uniqueIndex("content_reports_open_idx")
      .on(table.reporterUserId, table.subjectKind, table.subjectRef)
      .where(sql`${table.status} = 'open'`),
  ],
);

export type ContentReport = typeof contentReports.$inferSelect;

export const userBlocks = pgTable(
  "user_blocks",
  {
    id: uuid().primaryKey().defaultRandom(),
    blockingUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockedUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_blocks_pair_idx").on(
      table.blockingUserId,
      table.blockedUserId,
    ),
  ],
);
