import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { lineString } from "@/db/types";
import { user } from "./auth";
import { categories } from "./catalog";
import { municipalities } from "./geography";

export const routeStatus = pgEnum("route_status", [
  "pending",
  "published",
  "rejected",
]);
export const routeDifficulty = pgEnum("route_difficulty", [
  "easy",
  "moderate",
  "hard",
]);
export const ecoRoutes = pgTable(
  "eco_routes",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text().notNull(),
    categoryId: text()
      .notNull()
      .references(() => categories.id),
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id),
    path: lineString().notNull(),
    distanceMeters: integer().notNull(),
    durationMinutes: integer().notNull(),
    difficulty: routeDifficulty().notNull(),
    services: text().array().notNull().default([]),
    status: routeStatus().notNull().default("pending"),
    submittedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    reviewNote: text(),
    reviewedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("eco_routes_path_idx").using("gist", table.path),
    index("eco_routes_browse_idx").on(table.status, table.municipalityId),
  ],
);
