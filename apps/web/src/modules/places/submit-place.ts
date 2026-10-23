import { and, eq, inArray, sql } from "drizzle-orm";
import { categories, municipalities, placeReports, places } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import type { MemberViewer } from "@/modules/access/viewer";
import type { ReportPlaceInput, SubmitPlaceInput } from "./contracts";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);
}

export class PlaceSubmissionError extends Error {
  constructor(
    readonly reason:
      | "invalid_category"
      | "outside_province"
      | "verification_required"
      | "duplicate"
      | "not_found",
  ) {
    super(reason);
    this.name = "PlaceSubmissionError";
  }
}

export async function submitPlace(
  viewer: MemberViewer,
  input: SubmitPlaceInput,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      // Claiming to be standing at the point is a claim about a person, so it
      // is checked against who they are before anything is read or written.
      if (input.locationSource === "gps" && viewer.kind !== "citizen") {
        throw new PlaceSubmissionError("verification_required");
      }

      // A transaction owns one PostgreSQL connection, so these checks are
      // deliberately sequential. Parallel queries on that connection are
      // deprecated by pg and do not make the round-trips concurrent anyway.
      const category = await tx
        .select({ id: categories.id, kind: categories.kind })
        .from(categories)
        .where(
          and(
            eq(categories.id, input.categoryId),
            eq(categories.isActive, true),
            inArray(categories.kind, ["place", "business"]),
          ),
        )
        .limit(1);
      // Which municipality this is, asked of the geometry rather than of the
      // person filling in the form. A point determines its municipality; the
      // only thing a select could add is a way to get it wrong.
      const municipality = await tx
        .select({ id: municipalities.id })
        .from(municipalities)
        .where(
          sql`ST_Contains(${municipalities.boundary}, ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326))`,
        )
        .limit(1);

      if (!category[0]) throw new PlaceSubmissionError("invalid_category");
      if (input.business && category[0].kind !== "business")
        throw new PlaceSubmissionError("invalid_category");
      const municipalityId = municipality[0]?.id;
      if (!municipalityId) throw new PlaceSubmissionError("outside_province");

      // Submissions for one municipality are checked one at a time. Without
      // this lock, two simultaneous requests could both pass the proximity
      // check before either inserts, leaving duplicate pending places for the
      // moderation team to untangle.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`place-submission:${municipalityId}`}))`,
      );

      const duplicate = await tx
        .select({ id: places.id })
        .from(places)
        .where(
          and(
            eq(places.municipalityId, municipalityId),
            inArray(places.status, ["pending", "published"]),
            sql`word_similarity(unaccent(lower(${input.name})), unaccent(lower(${places.name}))) > 0.72`,
            sql`ST_DWithin(${places.location}::geography, ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography, 180)`,
          ),
        )
        .limit(1);

      if (duplicate[0]) throw new PlaceSubmissionError("duplicate");

      const id = crypto.randomUUID();
      const baseSlug = slugify(input.name) || "lugar";
      const slug = `${baseSlug}-${id.slice(0, 6)}`;
      const [created] = await tx
        .insert(places)
        .values({
          id,
          slug,
          name: input.name,
          description: input.description,
          address: input.address || null,
          categoryId: input.categoryId,
          municipalityId,
          location: { x: input.location.lng, y: input.location.lat },
          locationSource: input.locationSource,
          status: "pending",
          createdByUserId: viewer.userId,
          businessDetails: input.business ?? null,
        })
        .returning({ id: places.id, slug: places.slug });

      if (!created) throw new Error("Place insert returned no row.");

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "place.submitted",
          subjectType: "place",
          subjectId: created.id,
          municipalityId,
          metadata: {
            categoryId: input.categoryId,
            locationSource: input.locationSource,
          },
        },
        tx,
      );

      return { ...created, status: "pending" as const };
    },
  });

  return outcome.result;
}

export async function reportPlace(
  viewer: MemberViewer,
  input: ReportPlaceInput,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [place] = await tx
        .select({ id: places.id, municipalityId: places.municipalityId })
        .from(places)
        .where(
          and(eq(places.id, input.placeId), eq(places.status, "published")),
        )
        .limit(1);

      if (!place) throw new PlaceSubmissionError("not_found");

      const [created] = await tx
        .insert(placeReports)
        .values({
          placeId: place.id,
          reporterUserId: viewer.userId,
          reason: input.reason,
          details: input.details || null,
        })
        .returning({ id: placeReports.id });

      if (!created) throw new Error("Place report insert returned no row.");

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "place.reported",
          subjectType: "place_report",
          subjectId: created.id,
          municipalityId: place.municipalityId,
          metadata: { placeId: place.id, reason: input.reason },
        },
        tx,
      );

      return { id: created.id, status: "pending" as const };
    },
  });

  return outcome.result;
}
