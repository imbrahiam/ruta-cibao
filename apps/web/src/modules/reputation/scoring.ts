import type {
  badgeIds,
  contributionKinds,
  ReputationOutput,
  rankIds,
} from "@ruta/contracts";

type Kind = (typeof contributionKinds)[number];
type RankId = (typeof rankIds)[number];
type BadgeId = (typeof badgeIds)[number];

/** How many of each kind of accepted work a person has. */
export type Counts = Record<Kind, number> & {
  /** Distinct municipalities among the person's passport stamps. */
  stampTowns: number;
};

/**
 * Points for one of each. Work that took effort and passed review weighs
 * more than a tap; a support is worth a point so it never drowns the rest.
 */
export const POINTS: Record<Kind, number> = {
  place: 10,
  route: 15,
  consultation: 8,
  traffic: 4,
  confirmation: 2,
  stamp: 3,
  support: 1,
  invite: 10,
};

/** Invites stop adding points after this many, so the rank is earned on the map. */
export const INVITE_POINTS_CAP = 10;

export const RANKS: { id: RankId; min: number }[] = [
  { id: "vecino", min: 0 },
  { id: "explorador", min: 25 },
  { id: "guia", min: 75 },
  { id: "leyenda", min: 150 },
];

/** Each badge reads one number from the counts and asks for a target. */
const BADGES: { id: BadgeId; target: number; value: (c: Counts) => number }[] =
  [
    {
      id: "firstContribution",
      target: 1,
      value: (c) => c.place + c.route + c.consultation + c.traffic,
    },
    { id: "traveller", target: 5, value: (c) => c.stamp },
    { id: "threeTowns", target: 3, value: (c) => c.stampTowns },
    { id: "watchful", target: 10, value: (c) => c.confirmation },
    { id: "civicVoice", target: 1, value: (c) => c.consultation },
    { id: "roadWatch", target: 5, value: (c) => c.traffic },
    { id: "host", target: 1, value: (c) => c.invite },
  ];

const KINDS = Object.keys(POINTS) as Kind[];

export function score(
  counts: Counts,
): Pick<
  ReputationOutput,
  "points" | "rank" | "ranks" | "next" | "breakdown" | "badges"
> {
  const breakdown = KINDS.map((kind) => {
    const counted =
      kind === "invite"
        ? Math.min(counts.invite, INVITE_POINTS_CAP)
        : counts[kind];
    return {
      kind,
      count: counts[kind],
      each: POINTS[kind],
      points: counted * POINTS[kind],
    };
  });
  const points = breakdown.reduce((sum, line) => sum + line.points, 0);

  // The highest rank whose threshold is met; RANKS starts at zero.
  const at = RANKS.findLastIndex((rank) => points >= rank.min);
  const rank = RANKS[Math.max(at, 0)] as (typeof RANKS)[number];
  const nextRank = RANKS[at + 1];

  return {
    points,
    rank: rank.id,
    ranks: RANKS.map((r, index) => ({
      id: r.id,
      min: r.min,
      max: RANKS[index + 1]?.min ?? null,
    })),
    next: nextRank
      ? { id: nextRank.id, pointsToGo: nextRank.min - points }
      : null,
    breakdown,
    badges: BADGES.map((badge) => {
      const value = badge.value(counts);
      return {
        id: badge.id,
        earned: value >= badge.target,
        current: Math.min(value, badge.target),
        target: badge.target,
      };
    }),
  };
}
