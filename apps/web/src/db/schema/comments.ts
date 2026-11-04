import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { municipalities } from "./geography";
import { publicationStatus } from "./safety";

/**
 * What residents say under a consultation, and their experiences of a place.
 *
 * Published at once (post-moderation): anybody can report a comment, and staff
 * hide it through the same content-report queue as everything else. The
 * author can take their own down. Removing an account removes its comments.
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    subjectKind: text().$type<"consultation" | "place">().notNull(),
    /** The consultation's or place's id. */
    subjectId: uuid().notNull(),
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id),
    authorUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text().notNull(),
    status: publicationStatus().notNull().default("published"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("comments_subject_idx").on(
      table.subjectKind,
      table.subjectId,
      table.createdAt,
    ),
    index("comments_author_idx").on(table.authorUserId, table.createdAt),
  ],
);

export type Comment = typeof comments.$inferSelect;
