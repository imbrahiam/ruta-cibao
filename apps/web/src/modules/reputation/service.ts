import { ORPCError } from "@orpc/server";
import { and, count, countDistinct, desc, eq, inArray, ne } from "drizzle-orm";
import { type Db, db } from "@/db";
import {
  consultations,
  consultationVotes,
  ecoRoutes,
  invitations,
  memberProfiles,
  passportStamps,
  placeConfirmations,
  places,
  trafficReports,
  user,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { withIdempotency } from "@/lib/idempotency";
import type { MemberViewer } from "@/modules/access/viewer";
import { type Counts, score } from "./scoring";

/** The public page a shared invite link opens. */
export function inviteUrl(code: string): string {
  return new URL(`/i/${code}`, env.APP_URL).toString();
}

async function tally(executor: Db, userId: string): Promise<Counts> {
  const one = async (query: Promise<{ n: number }[]>) =>
    (await query)[0]?.n ?? 0;

  const [
    place,
    route,
    consultation,
    traffic,
    confirmation,
    support,
    invite,
    stamps,
  ] = await Promise.all([
    one(
      executor
        .select({ n: count() })
        .from(places)
        .where(
          and(
            eq(places.createdByUserId, userId),
            eq(places.status, "published"),
          ),
        ),
    ),
    one(
      executor
        .select({ n: count() })
        .from(ecoRoutes)
        .where(
          and(
            eq(ecoRoutes.submittedByUserId, userId),
            eq(ecoRoutes.status, "published"),
          ),
        ),
    ),
    one(
      executor
        .select({ n: count() })
        .from(consultations)
        .where(
          and(
            eq(consultations.openedByUserId, userId),
            eq(consultations.publicationStatus, "published"),
          ),
        ),
    ),
    one(
      executor
        .select({ n: count() })
        .from(trafficReports)
        .where(
          and(
            eq(trafficReports.reportedByUserId, userId),
            ne(trafficReports.status, "removed"),
          ),
        ),
    ),
    one(
      executor
        .select({ n: count() })
        .from(placeConfirmations)
        .where(eq(placeConfirmations.userId, userId)),
    ),
    one(
      executor
        .select({ n: count() })
        .from(consultationVotes)
        .where(eq(consultationVotes.userId, userId)),
    ),
    one(
      executor
        .select({ n: count() })
        .from(invitations)
        .where(eq(invitations.inviterUserId, userId)),
    ),
    // The stamped place is encrypted at rest; the column decrypts on read.
    executor
      .select({ placeId: passportStamps.placeId })
      .from(passportStamps)
      .where(eq(passportStamps.userId, userId)),
  ]);

  const stampTowns = stamps.length
    ? await one(
        executor
          .select({ n: countDistinct(places.municipalityId) })
          .from(places)
          .where(
            inArray(
              places.id,
              stamps.map((stamp) => stamp.placeId),
            ),
          ),
      )
    : 0;

  return {
    place,
    route,
    consultation,
    traffic,
    confirmation,
    stamp: stamps.length,
    support,
    invite,
    stampTowns,
  };
}

/** The signed-in person's standing, computed fresh from what they have done. */
export async function readReputation(viewer: MemberViewer) {
  const [counts, [invitedBy], joinedPeople] = await Promise.all([
    tally(db, viewer.userId),
    db
      .select({ name: memberProfiles.displayName, image: user.image })
      .from(invitations)
      .innerJoin(
        memberProfiles,
        eq(memberProfiles.userId, invitations.inviterUserId),
      )
      .innerJoin(user, eq(user.id, invitations.inviterUserId))
      .where(eq(invitations.inviteeUserId, viewer.userId))
      .limit(1),
    db
      .select({ name: memberProfiles.displayName, image: user.image })
      .from(invitations)
      .innerJoin(
        memberProfiles,
        eq(memberProfiles.userId, invitations.inviteeUserId),
      )
      .innerJoin(user, eq(user.id, invitations.inviteeUserId))
      .where(eq(invitations.inviterUserId, viewer.userId))
      .orderBy(desc(invitations.createdAt))
      .limit(5),
  ]);
  const { inviteCode, createdAt } = viewer.profile;
  return {
    ...score(counts),
    joinedAt: createdAt.toISOString(),
    invite: {
      code: inviteCode,
      url: inviteUrl(inviteCode),
      joined: counts.invite,
      redeemed: Boolean(invitedBy),
      invitedBy: invitedBy ?? null,
      joinedPeople,
    },
  };
}

/**
 * Names who invited this account. Once per account, never yourself; the
 * inviter gains recognition, nothing else changes hands.
 */
export async function redeemInvite(
  viewer: MemberViewer,
  input: { requestId: string; code: string },
) {
  const { result } = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [inviter] = await tx
        .select({
          userId: memberProfiles.userId,
          displayName: memberProfiles.displayName,
        })
        .from(memberProfiles)
        .where(eq(memberProfiles.inviteCode, input.code))
        .limit(1);
      if (!inviter) {
        throw new ORPCError("NOT_FOUND", {
          message: "No account has that invite code.",
          data: { reason: "unknown_code" },
        });
      }
      if (inviter.userId === viewer.userId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "That is your own invite code.",
          data: { reason: "own_code" },
        });
      }

      const inserted = await tx
        .insert(invitations)
        .values({ inviteeUserId: viewer.userId, inviterUserId: inviter.userId })
        .onConflictDoNothing({ target: invitations.inviteeUserId })
        .returning({ invitee: invitations.inviteeUserId });
      if (inserted.length === 0) {
        throw new ORPCError("CONFLICT", {
          message: "This account already named who invited it.",
          data: { reason: "already_redeemed" },
        });
      }

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "invite.redeemed",
          subjectType: "user",
          subjectId: inviter.userId,
        },
        tx,
      );
      return { status: "ok" as const, inviterName: inviter.displayName };
    },
  });
  return result;
}

/** What the public invite page shows: the inviter's display name, nothing else. */
export async function lookupInvite(code: string) {
  const [inviter] = await db
    .select({ displayName: memberProfiles.displayName })
    .from(memberProfiles)
    .where(eq(memberProfiles.inviteCode, code))
    .limit(1);
  if (!inviter) {
    throw new ORPCError("NOT_FOUND", {
      message: "No account has that invite code.",
      data: { reason: "unknown_code" },
    });
  }
  return { inviterName: inviter.displayName };
}
