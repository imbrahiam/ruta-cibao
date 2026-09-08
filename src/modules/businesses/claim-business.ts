import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { businessClaims, categories, places } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { formatPhone, normalizePhone } from "@/lib/phone";
import type { CitizenViewer, Viewer } from "@/modules/access/viewer";
import type { ClaimBusinessInput } from "./contracts";

/**
 * Saying a business on the map is yours.
 *
 * Citizen-only, and this is the tier line the contest brief draws: a business
 * listing carries a phone number the platform is vouching for, and the person
 * behind it has to be someone the civil registry can name. Anybody may put a
 * colmado on the map; only a verified resident may claim to run it.
 *
 * The claim is reviewed like any other contribution. "I own this" is not a fact
 * the platform can check, so a human looks at what the claimant offered as
 * evidence — which is why `evidence` is required and long enough to say
 * something.
 */
export class BusinessClaimError extends Error {
  constructor(
    readonly reason:
      | "not_found"
      | "not_a_business"
      | "already_claimed"
      | "already_pending"
      | "already_decided",
  ) {
    super(reason);
    this.name = "BusinessClaimError";
  }
}

export async function claimBusiness(
  viewer: CitizenViewer,
  input: ClaimBusinessInput,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [place] = await tx
        .select({
          id: places.id,
          name: places.name,
          municipalityId: places.municipalityId,
          kind: categories.kind,
        })
        .from(places)
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .where(
          and(eq(places.id, input.placeId), eq(places.status, "published")),
        )
        .limit(1);

      if (!place) throw new BusinessClaimError("not_found");
      // A river cannot have an owner, and the taxonomy is what says so.
      if (place.kind !== "business") {
        throw new BusinessClaimError("not_a_business");
      }

      const [existing] = await tx
        .select({
          id: businessClaims.id,
          status: businessClaims.status,
          claimantUserId: businessClaims.claimantUserId,
        })
        .from(businessClaims)
        .where(
          and(
            eq(businessClaims.placeId, place.id),
            sql`${businessClaims.status} in ('approved', 'pending')`,
          ),
        )
        .limit(1);

      if (existing?.status === "approved") {
        throw new BusinessClaimError("already_claimed");
      }
      if (existing?.status === "pending") {
        // A second person's claim on a business already under review is not
        // rejected outright — it is simply not queued twice. Whoever gets
        // turned down can claim again once the first is decided.
        throw new BusinessClaimError("already_pending");
      }

      const [created] = await tx
        .insert(businessClaims)
        .values({
          placeId: place.id,
          claimantUserId: viewer.userId,
          evidence: input.evidence,
          // Normalised at the boundary so the listing shows one shape and the
          // "llamar" link works, whichever of the six ways it was typed.
          contactPhone: input.contactPhone
            ? normalizePhone(input.contactPhone)
            : null,
          whatsapp: input.whatsapp ? normalizePhone(input.whatsapp) : null,
          openingHours: input.openingHours || null,
        })
        .returning({ id: businessClaims.id });

      if (!created) throw new Error("Business claim insert returned no row.");

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "business_claim.submitted",
          subjectType: "business_claim",
          subjectId: created.id,
          municipalityId: place.municipalityId,
          metadata: { placeId: place.id },
        },
        tx,
      );

      return { id: created.id };
    },
  });

  return { id: outcome.result.id, status: "pending" as const };
}

/**
 * What the place drawer needs to know before it decides what to offer.
 *
 * One query answering four questions, because they are all the same question
 * asked from different angles and splitting them would mean four round trips
 * for one button.
 */
export async function businessClaimState(
  db: Db,
  viewer: Viewer,
  placeId: string,
) {
  const viewerId = viewer.kind === "anonymous" ? null : viewer.userId;

  const [place] = await db
    .select({ kind: categories.kind, details: places.businessDetails })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .where(and(eq(places.id, placeId), eq(places.status, "published")))
    .limit(1);

  const claimable = place?.kind === "business";

  if (!claimable) {
    return {
      claimable: false,
      claimed: false,
      mine: false,
      pending: false,
      contactPhone: null,
      whatsapp: null,
      openingHours: null,
    };
  }

  const claims = await db
    .select({
      id: businessClaims.id,
      status: businessClaims.status,
      claimantUserId: businessClaims.claimantUserId,
      contactPhone: businessClaims.contactPhone,
      whatsapp: businessClaims.whatsapp,
      openingHours: businessClaims.openingHours,
    })
    .from(businessClaims)
    .where(
      and(
        eq(businessClaims.placeId, placeId),
        sql`${businessClaims.status} in ('approved', 'pending')`,
      ),
    );

  const approved = claims.find((claim) => claim.status === "approved");
  const pending = claims.find(
    (claim) => claim.status === "pending" && claim.claimantUserId === viewerId,
  );

  return {
    claimable: true,
    claimed: Boolean(approved),
    mine: Boolean(approved && approved.claimantUserId === viewerId),
    pending: Boolean(pending),
    // Only an approved claim's details are published. A pending one is a
    // request, and printing its phone number on the map would make review
    // pointless.
    contactPhone: approved?.contactPhone
      ? formatPhone(approved.contactPhone)
      : approved
        ? null
        : place.details?.contactPhone || null,
    whatsapp: approved?.whatsapp
      ? formatPhone(approved.whatsapp)
      : approved
        ? null
        : place.details?.whatsapp || null,
    openingHours: approved
      ? approved.openingHours
      : place.details?.openingHours || null,
  };
}
