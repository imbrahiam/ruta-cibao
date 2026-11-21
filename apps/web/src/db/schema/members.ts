import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { municipalities } from "./geography";

/**
 * Authority over other people's content.
 *
 * Separate from `user.role`, which belongs to Better Auth and answers a
 * different question — whether somebody may ban an account. This one answers
 * whether they may publish a neighbour's submission. Where it applies lives in
 * `staffMunicipalityId`, which only the audited staff grant writes.
 */
export const staffRole = pgEnum("staff_role", ["none", "moderator", "admin"]);

/**
 * What the platform knows about a signed-in person beyond their account.
 *
 * Participation needs a verified phone or email (on the Better Auth `user`
 * row), not an identity document. Everything here is either the person's own
 * choice (`displayName`, `municipalityId`) or something an official granted
 * in person or through the staff command.
 */
export const memberProfiles = pgTable(
  "member_profiles",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    staffRole: staffRole().notNull().default("none"),
    displayName: text().notNull(),

    /**
     * The municipality the person chose as theirs. Self-declared and editable;
     * it never grants authority, and a case's jurisdiction is chosen per case.
     */
    municipalityId: text().references(() => municipalities.id, {
      onDelete: "set null",
    }),

    /**
     * Where this person's moderation authority applies.
     *
     * Separate from `municipalityId`, which the person edits themselves: if
     * staff jurisdiction followed the personal choice, a moderator could move
     * their own authority by changing a profile field. Only the audited staff
     * grant writes this. Required for a moderator, null for everyone else
     * (an admin's scope is the whole province).
     */
    staffMunicipalityId: text().references(() => municipalities.id, {
      onDelete: "restrict",
    }),

    /**
     * The optional in-person resident badge: a municipal official checked,
     * face to face, that this person lives in `municipalityId`. Not a legal
     * identity proof and it buys no extra vote; cleared whenever the person
     * changes their municipality.
     */
    residencyVerifiedAt: timestamp({ withTimezone: true }),
    residencyVerifiedByUserId: text().references(() => user.id, {
      onDelete: "set null",
    }),

    /**
     * The person's invite code, on the link they share. Eight characters from
     * 0-9 and A-F, so it survives being read aloud or typed from a screenshot.
     * Not a secret: it only says who invited whom.
     */
    inviteCode: text()
      .notNull()
      .unique()
      .default(sql`upper(substr(md5(gen_random_uuid()::text), 1, 8))`),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("member_profiles_municipality_idx").on(table.municipalityId),
    index("member_profiles_staff_idx").on(table.staffRole),
    check(
      "member_profiles_staff_scope_check",
      sql`(${table.staffRole} = 'moderator' and ${table.staffMunicipalityId} is not null) or (${table.staffRole} <> 'moderator' and ${table.staffMunicipalityId} is null)`,
    ),
  ],
);

export type MemberProfile = typeof memberProfiles.$inferSelect;

/**
 * Who joined through whose invite. One row per invited account, ever: a
 * person can name one inviter, once, and never themselves. The inviter earns
 * recognition only; nothing here is money or a claim on anything.
 */
export const invitations = pgTable(
  "invitations",
  {
    inviteeUserId: text()
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    inviterUserId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invitations_inviter_idx").on(table.inviterUserId),
    check(
      "invitations_not_self_check",
      sql`${table.inviteeUserId} <> ${table.inviterUserId}`,
    ),
  ],
);
export type StaffRole = (typeof staffRole.enumValues)[number];
