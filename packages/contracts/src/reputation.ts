import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

/** Ranks, lowest first. Names and copy live in the catalogue (`reputation.rank.*`). */
export const rankIds = ["vecino", "explorador", "guia", "leyenda"] as const;
export const rankId = z.enum(rankIds);

/** What earns points. Only accepted work counts: published, not merely sent. */
export const contributionKinds = [
  "place",
  "route",
  "consultation",
  "traffic",
  "confirmation",
  "stamp",
  "support",
  "invite",
] as const;
export const contributionKind = z.enum(contributionKinds);

export const badgeIds = [
  "firstContribution",
  "traveller",
  "threeTowns",
  "watchful",
  "civicVoice",
  "roadWatch",
  "host",
] as const;
export const badgeId = z.enum(badgeIds);

/** An 8-character invite code: 0-9 and A-F, matched without regard to case. */
export const inviteCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9A-F]{8}$/);

/** Someone shown beside what they did: their chosen name and photo, nothing else. */
const person = z.object({ name: z.string(), image: z.string().nullable() });

export const reputationOutput = z.object({
  points: z.number().int(),
  joinedAt: z.iso.datetime(),
  rank: rankId,
  /** Every rank with its threshold, for the track. `max` is null on the last. */
  ranks: z.array(
    z.object({
      id: rankId,
      min: z.number().int(),
      max: z.number().int().nullable(),
    }),
  ),
  /** Null at the top rank. */
  next: z.object({ id: rankId, pointsToGo: z.number().int() }).nullable(),
  /** One line per kind of work: how many, and the points it brought. */
  breakdown: z.array(
    z.object({
      kind: contributionKind,
      count: z.number().int(),
      /** Points for one of these. */
      each: z.number().int(),
      points: z.number().int(),
    }),
  ),
  badges: z.array(
    z.object({
      id: badgeId,
      earned: z.boolean(),
      /** Progress toward it, capped at `target`. */
      current: z.number().int(),
      target: z.number().int(),
    }),
  ),
  invite: z.object({
    code: z.string(),
    /** The link to share: the public invite page for this code. */
    url: z.url(),
    /** People who joined with this code. */
    joined: z.number().int(),
    /** Whether this account already named who invited it. */
    redeemed: z.boolean(),
    /** Who invited this account, to show them by face and name. */
    invitedBy: person.nullable(),
    /** The latest few who joined with this code, newest first. */
    joinedPeople: z.array(person),
  }),
});
export type ReputationOutput = z.infer<typeof reputationOutput>;

export const redeemInviteInput = z.object({
  requestId: z.uuid(),
  code: inviteCode,
});
export const redeemInviteOutput = z.object({
  status: z.literal("ok"),
  /** The inviter's display name, to thank them by name. */
  inviterName: z.string(),
});

export const inviteLookupInput = z.object({ code: inviteCode });
export const inviteLookupOutput = z.object({
  /** The inviter's chosen display name; nothing else about them. */
  inviterName: z.string(),
});

export const reputationContract = {
  get: oc
    .meta(
      openapi({
        method: "GET",
        path: "/me/reputation",
        summary: "Your points, rank, badges and invite link",
      }),
    )
    .output(reputationOutput),

  redeemInvite: oc
    .meta(
      openapi({
        method: "POST",
        path: "/me/invite-redemptions",
        summary: "Name the person who invited you, once",
      }),
    )
    .input(redeemInviteInput)
    .output(redeemInviteOutput),

  /** Public: what the invite page shows about a code. */
  invite: oc
    .meta(
      openapi({
        method: "GET",
        path: "/invites/{code}",
        summary: "Who an invite code belongs to",
      }),
    )
    .input(inviteLookupInput)
    .output(inviteLookupOutput),
};
