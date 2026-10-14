import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  categories,
  consultations,
  consultationVotes,
  municipalities,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { publishRealtimeEvent } from "@/lib/realtime";
import type { CitizenViewer } from "@/modules/access/viewer";
import type {
  OpenConsultationInput,
  SupportConsultationInput,
} from "./contracts";

/**
 * Opening a case, and standing behind someone else's.
 *
 * Both are citizen-only, and that is the sharpest line in the tier matrix. A
 * consultation is addressed to an office that answers to residents, and support
 * counts are what the office uses to decide what to do first — so an
 * unverifiable account being able to open or back one would turn the queue into
 * something anybody with an email address could steer.
 *
 * "One resident, one voice" is not enforced here. It is enforced by the unique
 * index on the cédula blind index in `member_profiles`: one cédula is one
 * account, one account is one vote, and neither of those depends on this file
 * remembering to check.
 */
export const CONSULTATIONS_CHANNEL = "consultations";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);
}

export class ConsultationError extends Error {
  constructor(
    readonly reason:
      | "invalid_category"
      | "outside_province"
      | "not_found"
      | "closed"
      | "own_case",
  ) {
    super(reason);
    this.name = "ConsultationError";
  }
}

export async function openConsultation(
  viewer: CitizenViewer,
  input: OpenConsultationInput,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [category] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.id, input.categoryId),
            eq(categories.isActive, true),
            eq(categories.kind, "consultation"),
          ),
        )
        .limit(1);

      if (!category) throw new ConsultationError("invalid_category");

      // A case belongs to the citizen's own municipality, not to wherever they
      // dropped a pin. Verification set that field from the civil registry, so
      // it is the one claim about where somebody lives the platform can stand
      // behind — and it stops a resident of Sabaneta filing cases against
      // Monción's ayuntamiento.
      const municipalityId = viewer.profile.municipalityId;

      // The point, when there is one, still has to be inside the province.
      if (input.location) {
        const [inside] = await tx
          .select({ id: municipalities.id })
          .from(municipalities)
          .where(
            sql`ST_Contains(${municipalities.boundary}, ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326))`,
          )
          .limit(1);

        if (!inside) throw new ConsultationError("outside_province");
      }

      const id = crypto.randomUUID();
      const slug = `${slugify(input.title) || "caso"}-${id.slice(0, 6)}`;

      const [created] = await tx
        .insert(consultations)
        .values({
          id,
          slug,
          categoryId: input.categoryId,
          municipalityId,
          title: input.title,
          body: input.body,
          location: input.location
            ? { x: input.location.lng, y: input.location.lat }
            : null,
          openedByUserId: viewer.userId,
        })
        .returning({ id: consultations.id, slug: consultations.slug });

      if (!created) throw new Error("Consultation insert returned no row.");

      // Opening a case is standing behind it. Writing the vote here rather than
      // making the author tap "me pasa a mí" on their own case keeps the count
      // meaning "how many residents", instead of "how many minus one".
      await tx
        .insert(consultationVotes)
        .values({ consultationId: created.id, userId: viewer.userId })
        .onConflictDoNothing();

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "consultation.opened",
          subjectType: "consultation",
          subjectId: created.id,
          municipalityId,
          metadata: { categoryId: input.categoryId },
        },
        tx,
      );

      await publishRealtimeEvent(
        {
          channel: CONSULTATIONS_CHANNEL,
          municipalityId,
          subjectType: "consultation",
          subjectId: created.id,
          action: "created",
        },
        tx,
      );
      return { ...created, municipalityId };
    },
  });

  return {
    id: outcome.result.id,
    slug: outcome.result.slug,
    status: "open" as const,
  };
}

/**
 * Adding or withdrawing a voice.
 *
 * The caller says what the end state should be rather than asking for a toggle,
 * so a double tap on a bad connection lands somewhere sensible instead of
 * cancelling itself.
 */
export async function supportConsultation(
  db: Db,
  viewer: CitizenViewer,
  input: SupportConsultationInput,
) {
  return db.transaction(async (tx) => {
    const [consultation] = await tx
      .select({
        id: consultations.id,
        status: consultations.status,
        municipalityId: consultations.municipalityId,
      })
      .from(consultations)
      .where(eq(consultations.id, input.consultationId))
      .limit(1);

    if (!consultation) throw new ConsultationError("not_found");
    // A resolved or rejected case is a closed conversation. Letting support
    // accumulate on it would only produce a number nobody will ever act on.
    if (
      consultation.status === "resolved" ||
      consultation.status === "rejected"
    ) {
      throw new ConsultationError("closed");
    }

    if (input.supported) {
      await tx
        .insert(consultationVotes)
        .values({ consultationId: consultation.id, userId: viewer.userId })
        .onConflictDoNothing();
    } else {
      await tx
        .delete(consultationVotes)
        .where(
          and(
            eq(consultationVotes.consultationId, consultation.id),
            eq(consultationVotes.userId, viewer.userId),
          ),
        );
    }

    await recordAudit(
      {
        actorUserId: viewer.userId,
        action: input.supported
          ? "consultation.supported"
          : "consultation.support_withdrawn",
        subjectType: "consultation",
        subjectId: consultation.id,
        municipalityId: consultation.municipalityId,
      },
      tx,
    );

    const [counted] = await tx
      .select({ supportCount: sql<number>`count(*)::int` })
      .from(consultationVotes)
      .where(eq(consultationVotes.consultationId, consultation.id));

    return {
      supported: input.supported,
      supportCount: counted?.supportCount ?? 0,
    };
  });
}
