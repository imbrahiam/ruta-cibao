import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { municipalities } from "./geography";

/**
 * Append-only record of every mutation.
 *
 * A municipality has to be able to answer "who approved this, and when" months
 * later, so nothing here is ever updated or deleted by application code.
 * The actor is kept as a nullable reference: when an account is removed the
 * trail survives with the actor blanked, rather than disappearing with them.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorUserId: text().references(() => user.id, { onDelete: "set null" }),
    /** Dotted verb, e.g. `place.approved`, `consultation.answered`. */
    action: text().notNull(),
    subjectType: text().notNull(),
    subjectId: text(),
    municipalityId: text().references(() => municipalities.id, {
      onDelete: "set null",
    }),
    /** Whatever the action needs to be intelligible later. Never raw PII. */
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    /** Hashed, not stored raw: enough to correlate abuse, not to track a person. */
    ipHash: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_subject_idx").on(table.subjectType, table.subjectId),
    index("audit_events_actor_idx").on(table.actorUserId),
    index("audit_events_created_idx").on(table.createdAt),
  ],
);

/**
 * Rate limiting, in Postgres rather than Redis.
 *
 * One fewer service to run and to explain in the handover runbook, which is
 * worth more here than the throughput a dedicated store would buy.
 * Rows are disposable; a cleanup job drops expired ones.
 */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    /** HMAC of scope + identifier + window start, so no identifier is readable. */
    key: text().primaryKey(),
    scope: text().notNull(),
    requestCount: integer().notNull().default(0),
    resetAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limit_buckets_reset_idx").on(table.resetAt)],
);

/**
 * Replay protection for mutations arriving from the offline queue.
 *
 * A phone in a dead zone queues a report and retries on reconnect, sometimes
 * more than once. The first request stores its response here; retries with the
 * same key get that response back instead of creating a second report.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: text().primaryKey(),
    userId: text().references(() => user.id, { onDelete: "cascade" }),
    /** Digest of the request body: the same key with different content is a bug, not a retry. */
    requestHash: text().notNull(),
    responseStatus: integer(),
    responseBody: jsonb().$type<unknown>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [index("idempotency_keys_expires_idx").on(table.expiresAt)],
);

/**
 * In-app notification centre.
 *
 * Stores a translation key and its parameters rather than a rendered sentence:
 * the catalogue is the single source of user-facing text, and a notification
 * written today still renders in whatever language the reader picks tomorrow.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Key into `messages/<locale>.json`, e.g. `notifications.placeApproved`. */
    messageKey: text().notNull(),
    dedupeKey: text().unique(),
    params: jsonb()
      .$type<Record<string, string | number>>()
      .notNull()
      .default({}),
    /** Where tapping it should go. */
    href: text(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_unread_idx").on(table.userId, table.readAt),
  ],
);

/**
 * Browser push endpoints.
 *
 * The keys are per-device secrets that let anyone holding them push to that
 * device, so they are encrypted at rest like any other credential.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text().notNull().unique(),
    p256dhCiphertext: text().notNull(),
    authCiphertext: text().notNull(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("push_subscriptions_user_idx").on(table.userId)],
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

/** Individual reservations for limits that must hold across rolling windows. */
export const rollingRateLimits = pgTable(
  "rolling_rate_limits",
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    index("rolling_rate_limits_key_time_idx").on(table.key, table.createdAt),
    index("rolling_rate_limits_expiry_idx").on(table.expiresAt),
  ],
);

/** Domain transactions write jobs here before they commit. */
export const jobOutbox = pgTable(
  "job_outbox",
  {
    id: uuid().primaryKey().defaultRandom(),
    queue: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_outbox_pending_idx").on(table.processedAt, table.createdAt),
  ],
);

/** The worker updates one row; readiness can detect a stopped worker. */
export const workerHeartbeats = pgTable("worker_heartbeats", {
  id: text().primaryKey(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
