import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Account deletions, and the tombstones they leave.
 *
 * Deliberately no foreign key to `user`: the row has to outlive the account it
 * describes. `id` is the receipt the app generated and stored before sending the
 * request, so a person who lost the acknowledgement (or whose sessions were
 * revoked) can still ask whether it finished.
 *
 * While `pending`, `inventoryCiphertext` holds the encrypted inventory of what
 * the cleanup has to remove (content ids and object keys). Once `completed`
 * the inventory is dropped and only the internal ids remain: no names, contact
 * details or content, just enough for a restore to re-apply the deletion.
 */
export const accountDeletions = pgTable(
  "account_deletions",
  {
    id: uuid().primaryKey(),
    userId: text().notNull().unique(),
    status: text()
      .$type<"pending" | "completed">()
      .notNull()
      .default("pending"),
    inventoryCiphertext: text(),
    attempts: integer().notNull().default(0),
    requestedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index("account_deletions_status_idx").on(table.status)],
);

export type AccountDeletion = typeof accountDeletions.$inferSelect;
