import { and, eq, sql } from "drizzle-orm";
import type { Db, DbTransaction } from "@/db";
import { placeConfirmations, placeReports, places } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import type { MemberViewer } from "@/modules/access/viewer";

/**
 * How much a place can be believed.
 *
 * A civic map fails in two directions and only one of them is obvious. The
 * loud failure is a place that was never there. The quiet one is a place that
 * was there in 2024 — the clinic moved, the colmado closed, the bridge washed
 * out — and the map still sends people to it. Moderation catches the first;
 * only the people walking past catch the second.
 *
 * So the signal is a question anybody can answer from the sidewalk, one
 * verified account one answer, and surfaced as a state
 * rather than a number. "Confirmado por 4 vecinos" is a fact somebody can act
 * on; a 78% reliability score is a number nobody can.
 */

/**
 * Every verified account's word counts once. The stored weight column stays so
 * the tally reads the same query either way; nothing writes anything but this.
 */
export const CONFIRMATION_WEIGHT = 1;

/** Enough agreement that the map should stop asking. */
const CONFIRMED_SCORE = 3;
/** Enough disagreement that a human should look. */
const DOUBT_SCORE = 3;
/** Below this age a place is still introducing itself. */
const NEW_DAYS = 14;

export type TrustState = "new" | "confirmed" | "doubted" | "established";

export type PlaceTrust = {
  state: TrustState;
  /** People who said it is still there. Headcount, not weight — it is shown. */
  confirmations: number;
  doubts: number;
  /** Days since it was published, or null for a place with no date. */
  ageDays: number | null;
};

export function trustState(input: {
  confirmedWeight: number;
  doubtWeight: number;
  ageDays: number | null;
}): TrustState {
  // Doubt outranks everything: a place several neighbours say is gone must not
  // read as "confirmed" because more people agreed with it last year.
  if (
    input.doubtWeight >= DOUBT_SCORE &&
    input.doubtWeight >= input.confirmedWeight
  ) {
    return "doubted";
  }
  if (input.confirmedWeight >= CONFIRMED_SCORE) return "confirmed";
  if (input.ageDays !== null && input.ageDays <= NEW_DAYS) return "new";
  return "established";
}

/** The tallies for one place, in a single round trip. */
export async function placeTrust(
  db: Db | DbTransaction,
  placeId: string,
  publishedAt: Date | null,
): Promise<PlaceTrust> {
  const [row] = await db
    .select({
      confirmedWeight: sql<number>`coalesce(sum(case when ${placeConfirmations.verdict} = 'exists' then ${placeConfirmations.weight} else 0 end), 0)::int`,
      doubtWeight: sql<number>`coalesce(sum(case when ${placeConfirmations.verdict} = 'gone' then ${placeConfirmations.weight} else 0 end), 0)::int`,
      confirmations: sql<number>`count(*) filter (where ${placeConfirmations.verdict} = 'exists')::int`,
      doubts: sql<number>`count(*) filter (where ${placeConfirmations.verdict} = 'gone')::int`,
    })
    .from(placeConfirmations)
    .where(eq(placeConfirmations.placeId, placeId));

  const ageDays = publishedAt
    ? Math.floor((Date.now() - publishedAt.getTime()) / 86_400_000)
    : null;

  return {
    state: trustState({
      confirmedWeight: row?.confirmedWeight ?? 0,
      doubtWeight: row?.doubtWeight ?? 0,
      ageDays,
    }),
    confirmations: row?.confirmations ?? 0,
    doubts: row?.doubts ?? 0,
    ageDays,
  };
}

export class ConfirmationError extends Error {
  constructor(readonly reason: "not_found" | "own_place") {
    super(reason);
    this.name = "ConfirmationError";
  }
}

/**
 * Recording one person's answer.
 *
 * Idempotent by the unique index rather than by an idempotency key: this is a
 * toggle, not a creation, and the end state of tapping "sí" twice is the same
 * row either way.
 */
export async function confirmPlace(
  db: Db,
  viewer: MemberViewer,
  input: { placeId: string; verdict: "exists" | "gone" },
): Promise<PlaceTrust> {
  return db.transaction(async (tx) => {
    const [place] = await tx
      .select({
        id: places.id,
        municipalityId: places.municipalityId,
        publishedAt: places.publishedAt,
        createdByUserId: places.createdByUserId,
      })
      .from(places)
      .where(and(eq(places.id, input.placeId), eq(places.status, "published")))
      .limit(1)
      .for("update");

    if (!place) throw new ConfirmationError("not_found");
    // Vouching for your own submission is not evidence of anything.
    if (place.createdByUserId === viewer.userId) {
      throw new ConfirmationError("own_place");
    }

    const weight = CONFIRMATION_WEIGHT;

    await tx
      .insert(placeConfirmations)
      .values({
        placeId: place.id,
        userId: viewer.userId,
        verdict: input.verdict,
        weight,
      })
      .onConflictDoUpdate({
        target: [placeConfirmations.placeId, placeConfirmations.userId],
        set: { verdict: input.verdict, weight, updatedAt: new Date() },
      });

    await recordAudit(
      {
        actorUserId: viewer.userId,
        action: "place.confirmed",
        subjectType: "place",
        subjectId: place.id,
        municipalityId: place.municipalityId,
        metadata: { verdict: input.verdict },
      },
      tx,
    );

    const trust = await placeTrust(tx, place.id, place.publishedAt);

    // Crossing into doubt hands the place to a moderator, once. The community
    // layer raises the question; a person still answers it, because taking a
    // clinic off the map is not something a vote total should be able to do.
    if (trust.state === "doubted") {
      await raiseDoubtReport(tx, place.id);
    }

    return trust;
  });
}

async function raiseDoubtReport(
  db: Db | DbTransaction,
  placeId: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: placeReports.id })
    .from(placeReports)
    .where(
      and(
        eq(placeReports.placeId, placeId),
        eq(placeReports.status, "pending"),
        // The community's own report has no reporter: it is the map speaking,
        // not a person, and the moderation queue shows it as such.
        sql`${placeReports.reporterUserId} is null`,
      ),
    )
    .limit(1);

  if (existing) return;

  await db.insert(placeReports).values({
    placeId,
    reporterUserId: null,
    reason: "closed",
    details: null,
  });
}
