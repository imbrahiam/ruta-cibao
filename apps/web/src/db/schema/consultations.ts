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
import { point } from "../types";
import { user } from "./auth";
import { categories } from "./catalog";
import { municipalities } from "./geography";
import { publicationStatus } from "./safety";

/**
 * Where a citizen case stands with the municipality.
 *
 * The states are written from the citizen's side, not the office's, because the
 * citizen is the one waiting: `open` means nobody has picked it up, `in_review`
 * means somebody has, `answered` means there is a reply to read, `resolved`
 * means the thing itself was dealt with, and `rejected` means the ayuntamiento
 * said no — which is an answer too, and one that has to be sayable, with a
 * reason, rather than left to rot in `open` forever.
 */
export const consultationStatus = pgEnum("consultation_status", [
  "open",
  "in_review",
  "answered",
  "resolved",
  "rejected",
]);

/**
 * A case a resident opens with their ayuntamiento.
 *
 * Only a cédula-verified citizen may open one, and that is the whole design
 * rather than a restriction bolted on: a consultation is a claim about a place
 * somebody lives, addressed to an office that answers to them. The unique index
 * on the cédula blind index in `member_profiles` is what makes "one resident,
 * one voice" true here — support is counted per account, and an account is
 * ultimately per cédula.
 *
 * `location` is nullable because not every case is a point. "El agua llega
 * salada en todo el barrio" has no coordinate, and forcing one would either
 * invent a fact or block the report.
 */
export const consultations = pgTable(
  "consultations",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Stable, human-readable, and what `/consultas/[slug]` is built from. */
    slug: text().notNull(),
    /** A `consultation` category: agua potable, calles y caminos, basura. */
    categoryId: text()
      .notNull()
      .references(() => categories.id),
    municipalityId: text()
      .notNull()
      .references(() => municipalities.id),

    title: text().notNull(),
    body: text().notNull(),
    /** Optional, and read from the geometry when it is given. */
    location: point(),

    status: consultationStatus().notNull().default("open"),
    /**
     * Whether other people may see the case. Separate from `status`, which is
     * the municipality's workflow: a new case is `pending` until staff review
     * it, and only the author and staff see it until then.
     */
    publicationStatus: publicationStatus().notNull().default("pending"),
    /** Why staff hid the case, shown to its author. */
    reviewNote: text(),
    /** Null once the account is gone; the case and its answers survive it. */
    openedByUserId: text().references(() => user.id, { onDelete: "set null" }),

    /** When the first official reply landed, for "how long did this take". */
    answeredAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("consultations_slug_idx").on(table.slug),
    // The list is always one municipality, newest first, usually filtered by
    // state; the office desk is the same query with the states inverted.
    index("consultations_municipality_idx").on(
      table.municipalityId,
      table.status,
      table.createdAt,
    ),
    index("consultations_author_idx").on(table.openedByUserId),
    index("consultations_location_idx").using("gist", table.location),
  ],
);

export type Consultation = typeof consultations.$inferSelect;
export type ConsultationStatus = (typeof consultationStatus.enumValues)[number];

/**
 * "Esto también me pasa a mí."
 *
 * Support, not a rating: there is no way to vote against a neighbour's case.
 * The only question a civic queue needs answered is how many people this
 * affects, and a downvote answers a different one — whether the person asking
 * deserves to be heard — which is not something the platform should let anyone
 * decide.
 *
 * One row per account, and the unique index is the mechanism. Withdrawing
 * support deletes the row rather than flipping a flag, so the table never keeps
 * a record of what somebody briefly agreed with.
 */
export const consultationVotes = pgTable(
  "consultation_votes",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("consultation_votes_case_user_idx").on(
      table.consultationId,
      table.userId,
    ),
    index("consultation_votes_case_idx").on(table.consultationId),
  ],
);

export type ConsultationVote = typeof consultationVotes.$inferSelect;

/**
 * What the ayuntamiento wrote back.
 *
 * A table rather than a column on the case, because the real shape of an answer
 * is a sequence: "lo estamos viendo", then "la brigada va el martes", then
 * "listo". Collapsing that into one field would mean each update erased the
 * last, and a resident who was told something in March could not point at it in
 * May.
 *
 * Each entry carries the state it moved the case to, so the status history is
 * the response history and there is no second place for the two to disagree.
 */
export const consultationResponses = pgTable(
  "consultation_responses",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    body: text().notNull(),
    /** The official who wrote it. Null once their account is gone. */
    authorUserId: text().references(() => user.id, { onDelete: "set null" }),
    /** Where this reply left the case. */
    statusAfter: consultationStatus().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("consultation_responses_case_idx").on(
      table.consultationId,
      table.createdAt,
    ),
  ],
);

export type ConsultationResponse = typeof consultationResponses.$inferSelect;

/**
 * Photos a case carries, in the author's order (at most four, enforced where
 * they are attached). Dimensions are stored so a feed can reserve the space
 * before the image arrives. `storageKey` is a bucket key, or a `/…` path for
 * seeded imagery shipped in `public/` (see `imageUrl`).
 */
export const consultationPhotos = pgTable(
  "consultation_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    storageKey: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    /** What a screen reader says instead. */
    alt: text(),
    position: integer().notNull().default(0),
    uploadedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("consultation_photos_key_idx").on(table.storageKey),
    index("consultation_photos_case_idx").on(
      table.consultationId,
      table.position,
    ),
  ],
);

export type ConsultationPhoto = typeof consultationPhotos.$inferSelect;

/** Durable capabilities and receipts; retrying a request never creates a second photo. */
export const consultationPhotoUploads = pgTable(
  "consultation_photo_uploads",
  {
    storageKey: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    consultationId: uuid()
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    requestId: uuid().notNull(),
    requestHash: text().notNull(),
    sizeBytes: integer().notNull(),
    contentType: text().notNull(),
    finalKey: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    temporaryDeletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex("consultation_photo_uploads_user_request_idx").on(
      table.userId,
      table.requestId,
    ),
    index("consultation_photo_uploads_expiry_idx").on(table.expiresAt),
  ],
);
