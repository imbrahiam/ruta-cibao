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
import { encryptedText } from "../types";
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
 * How far verification got.
 *
 * Two checks make a verified resident, and this column tracks both:
 *
 *   The civil registry (JCE) confirms the cédula exists and gives the name on
 *   it. That proves the number is real, not that the person typing it owns it.
 *
 *   The municipality then looks at a photo of the cédula and a photo of the
 *   person holding it, and decides. That is the check that ties the number to
 *   a face, and the one a ward office already knows how to do.
 *
 *   none       nothing submitted
 *   pending    cédula submitted, the registry has not answered yet (it goes
 *              down and rate-limits); a retry job finishes it
 *   matched    the registry found the cédula; photos still to send
 *   in_review  photos sent, waiting for the municipality
 *   verified   the municipality approved — a citizen
 *   rejected   the registry has no such cédula
 *   unavailable  legacy; no code path writes it any more
 *
 * Whether the registry has answered is `verifiedFullName`: set the moment it
 * finds the cédula, so a review can be in progress while the registry is still
 * catching up, and the retry job knows which rows to finish.
 */
export const cedulaStatus = pgEnum("cedula_status", [
  "none",
  "pending",
  "verified",
  "unavailable",
  "rejected",
  "matched",
  "in_review",
]);

/**
 * Authority over other people's content.
 *
 * Separate from `user.role`, which belongs to Better Auth and answers a
 * different question — whether somebody may ban an account. This one answers
 * whether they may publish a neighbour's submission, and it lives on the
 * profile because the municipality that limits it lives here too. An official
 * in Monción moderating Sabaneta is the failure mode this column exists to
 * make impossible.
 */
export const staffRole = pgEnum("staff_role", ["none", "moderator", "admin"]);

export const memberProfiles = pgTable(
  "member_profiles",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    tier: memberTier().notNull().default("visitor"),
    staffRole: staffRole().notNull().default("none"),
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

    /**
     * When the person said whether they live here.
     *
     * Set by either answer on the welcome screen — "verify my cédula" or "I am
     * just visiting" — so the fork is asked once and never again. Knowing
     * somebody is a tourist is worth as much as knowing they are a resident:
     * both stop the app from nagging, and only one of them can vote.
     */
    residencyDeclaredAt: timestamp({ withTimezone: true }),

    /**
     * The name the registry returned, uppercase as JCE stores it. Set when the
     * registry finds the cédula and it matches the name the person typed —
     * before the municipality has reviewed anything — because it is what the
     * reviewer compares the photos against. Encrypted at rest: with the cédula
     * it identifies a person.
     */
    verifiedFullName: encryptedText(),
    /**
     * The name the person typed next to their cédula, kept only while the
     * registry has not answered, so the retry job can make the same comparison
     * the live lookup would have. Cleared once it has.
     */
    claimedName: encryptedText(),
    /**
     * When this profile took hold of the cédula in `cedulaBlindIndex`. A hold
     * that never reached the municipality lapses after a few days, so somebody
     * typing a neighbour's number cannot lock its owner out indefinitely.
     */
    cedulaClaimedAt: timestamp({ withTimezone: true }),
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
    index("member_profiles_staff_idx").on(table.staffRole),
  ],
);

export type MemberProfile = typeof memberProfiles.$inferSelect;
export type MemberTier = (typeof memberTier.enumValues)[number];
export type StaffRole = (typeof staffRole.enumValues)[number];

/**
 * Where a request for verification stands with the municipality.
 */
export const identityReviewStatus = pgEnum("identity_review_status", [
  "pending",
  "approved",
  "rejected",
]);

/**
 * Why a request was turned down, as the person will read it. A short fixed
 * list so the message they get says what to do next rather than a reviewer's
 * free text; the optional note adds detail.
 */
export const identityReviewReason = pgEnum("identity_review_reason", [
  "unreadable",
  "mismatch",
  "not_resident",
  "incomplete",
  "other",
]);

/**
 * A request to become a verified resident, with the evidence for it.
 *
 * The photos themselves are in object storage, encrypted with the same key as
 * the cédula before they leave this server, under keys only this table knows.
 * They exist for one purpose — the decision — and are deleted when it is made
 * (`documentsPurgedAt`). What stays is the outcome, who decided and why, which
 * is what an audit needs and all an audit needs.
 *
 * At most one open request per person: the partial unique index makes a
 * double-submitted form a constraint violation rather than two queue entries.
 */
export const identityReviews = pgTable(
  "identity_reviews",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The municipality the person says they live in. The reviewer checks it. */
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id, { onDelete: "restrict" }),
    status: identityReviewStatus().notNull().default("pending"),

    /** Object keys of the encrypted photos. */
    frontKey: text().notNull(),
    selfieKey: text().notNull(),
    residenceKey: text(),

    submittedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp({ withTimezone: true }),
    reviewedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    reason: identityReviewReason(),
    /** Optional detail for the person, written by the reviewer. */
    note: text(),
    documentsPurgedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("identity_reviews_queue_idx").on(
      table.status,
      table.municipalityId,
      table.submittedAt,
    ),
    index("identity_reviews_user_idx").on(table.userId, table.submittedAt),
    uniqueIndex("identity_reviews_one_open_idx")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export type IdentityReview = typeof identityReviews.$inferSelect;
export type IdentityReviewReason =
  (typeof identityReviewReason.enumValues)[number];
