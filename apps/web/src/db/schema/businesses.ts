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
import { places } from "./places";

/**
 * Registering a business is claiming one, not creating a second kind of place.
 *
 * A colmado is a point on the map with a name, a category and a location —
 * which is exactly what `places` already is, and the taxonomy already reserves
 * `kind: business` for it. A parallel `businesses` table would mean two
 * pipelines to moderate, two tile sources, two search paths and two ways for
 * the same colmado to exist twice.
 *
 * So what is missing is not the business. It is the answer to "who says this is
 * theirs", and that is what this table is: a claim, reviewed like every other
 * contribution, that turns into the right to keep the listing current.
 */
export const businessClaimStatus = pgEnum("business_claim_status", [
  "pending",
  "approved",
  "rejected",
]);

export const businessClaims = pgTable(
  "business_claims",
  {
    id: uuid().primaryKey().defaultRandom(),
    placeId: uuid()
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),

    /**
     * Cascade rather than `set null`, which is the opposite of every other
     * author column here — and deliberately so. Elsewhere the row is a record
     * of something that happened and outlives the account that caused it. This
     * row *is* the ownership: an approved claim with nobody behind it would
     * leave a business owned by no one and unclaimable by anyone, because the
     * partial index below would still be holding the slot.
     */
    claimantUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /** Why they say it is theirs. Free text: an RNC, a name, a description. */
    evidence: text().notNull(),
    /** Published contact details, which is what the claim is for. */
    contactPhone: text(),
    whatsapp: text(),
    /** Free text, because rural opening hours are sentences, not a schedule. */
    openingHours: text(),

    status: businessClaimStatus().notNull().default("pending"),
    reviewedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    /** Shown to the claimant when a claim is turned down. */
    reviewNote: text(),
    decidedAt: timestamp({ withTimezone: true }),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("business_claims_place_idx").on(table.placeId, table.status),
    index("business_claims_claimant_idx").on(table.claimantUserId),

    // One owner per business, enforced by the database rather than by a check
    // in whichever handler happens to run first. Partial, so the rejected and
    // pending history stays as many rows as it needs to be.
    uniqueIndex("business_claims_owner_idx")
      .on(table.placeId)
      .where(sql`status = 'approved'`),

    // And one open claim per person per business, so a claimant who taps twice
    // does not put the same request in the queue twice.
    uniqueIndex("business_claims_open_idx")
      .on(table.placeId, table.claimantUserId)
      .where(sql`status = 'pending'`),
  ],
);

export type BusinessClaim = typeof businessClaims.$inferSelect;
export type BusinessClaimStatus =
  (typeof businessClaimStatus.enumValues)[number];
