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
 * What a signed-in account is allowed to do.
 *
 * `visitor_anon` is not here on purpose: it means no account at all, so there
 * is no row to describe it.
 */
export const memberTier = pgEnum("member_tier", ["visitor", "citizen"]);

/**
 * How far cédula verification got.
 *
 * `unavailable` is a real state, not an error: the civil registry is a
 * government service that goes down and rate-limits, so a citizen waits in this
 * state while a retry job works rather than being turned away.
 */
export const cedulaStatus = pgEnum("cedula_status", [
  "none",
  "pending",
  "verified",
  "unavailable",
  "rejected",
]);

export const memberProfiles = pgTable(
  "member_profiles",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    tier: memberTier().notNull().default("visitor"),
    displayName: text().notNull(),

    /** A visitor has none; a citizen's is set from their verified cédula. */
    municipalityId: text().references(() => municipalities.id, {
      onDelete: "set null",
    }),

    /**
     * The cédula itself, encrypted. Never selected for display — the platform
     * shows `verifiedFullName` instead, so the number stays out of every page,
     * log line and API response.
     */
    cedulaCiphertext: text(),
    /**
     * Keyed HMAC of the same cédula. Deterministic, so it can carry the unique
     * index that enforces one account per cédula and answers "is this cédula
     * already registered" without ever decrypting anything.
     */
    cedulaBlindIndex: text(),
    cedulaStatus: cedulaStatus().notNull().default("none"),

    /** The name the registry returned. Uppercase, as JCE stores it. */
    verifiedFullName: text(),
    verifiedAt: timestamp({ withTimezone: true }),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // One cédula, one account. This is what makes "one citizen, one vote" hold
    // in consultations, and it is enforced by the database rather than by
    // whichever code path happens to run first.
    uniqueIndex("member_profiles_cedula_idx").on(table.cedulaBlindIndex),
    index("member_profiles_municipality_idx").on(table.municipalityId),
    index("member_profiles_tier_idx").on(table.tier),
  ],
);

export type MemberProfile = typeof memberProfiles.$inferSelect;
export type MemberTier = (typeof memberTier.enumValues)[number];
