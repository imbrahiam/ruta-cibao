import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { encryptedText } from "../types";
import { user } from "./auth";

/** Private visit history: destinations are encrypted, deduplication is keyed. */
export const passportStamps = pgTable(
  "passport_stamps",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    placeBlindIndex: text().notNull(),
    placeId: encryptedText().notNull(),
    stampedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("passport_stamps_user_place_idx").on(
      table.userId,
      table.placeBlindIndex,
    ),
    index("passport_stamps_user_date_idx").on(
      table.userId,
      table.stampedAt,
      table.id,
    ),
  ],
);
