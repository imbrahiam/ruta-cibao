import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { categories } from "@/db/schema";
import {
  ConsultationError,
  openConsultation,
  supportConsultation,
} from "@/modules/consultations/open-consultation";
import {
  browseConsultations,
  consultationDetail,
} from "@/modules/consultations/read";
import { respondToConsultation } from "@/modules/consultations/respond";
import { impl, member, moderator } from "../base";

/**
 * Citizen consultations, as an API.
 *
 * Anybody may read a published case, a member with a verified contact may
 * open one or add their voice, and only an official may answer. Nothing here re-checks
 * that — the middleware each entry is attached to is the check, so a new
 * procedure cannot quietly skip it.
 */
function asConsultationError(error: unknown): never {
  if (!(error instanceof ConsultationError)) throw error;

  switch (error.reason) {
    case "not_found":
      throw new ORPCError("NOT_FOUND", {
        message: "That case does not exist.",
        data: { reason: error.reason },
      });
    case "closed":
      throw new ORPCError("CONFLICT", {
        message: "That case is already closed.",
        data: { reason: error.reason },
      });
    default:
      throw new ORPCError("BAD_REQUEST", {
        message: "The case is not valid.",
        data: { reason: error.reason },
      });
  }
}

export const consultationsRouter = {
  /** The consultation taxonomy, for the form and the filter chips. */
  categories: impl.consultations.categories.handler(({ context }) =>
    context.db
      .select({
        id: categories.id,
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
      })
      .from(categories)
      .where(
        and(eq(categories.kind, "consultation"), eq(categories.isActive, true)),
      )
      .orderBy(categories.sortOrder),
  ),

  browse: impl.consultations.browse.handler(async ({ context, input }) =>
    browseConsultations(context.db, await context.getViewer(), input),
  ),

  detail: impl.consultations.detail.handler(async ({ context, input }) =>
    consultationDetail(context.db, await context.getViewer(), input.slug).catch(
      asConsultationError,
    ),
  ),

  open: impl.consultations.open
    .use(member)
    .handler(({ context, input, errors }) =>
      openConsultation(context.viewer, input).catch((error: unknown) => {
        if (
          error instanceof ConsultationError &&
          error.reason === "municipality_mismatch" &&
          error.pointMunicipalityId
        ) {
          throw errors.MUNICIPALITY_MISMATCH({
            message: "The point is in another municipality.",
            data: {
              reason: "municipality_mismatch",
              pointMunicipalityId: error.pointMunicipalityId,
            },
          });
        }
        return asConsultationError(error);
      }),
    ),

  support: impl.consultations.support
    .use(member)
    .handler(({ context, input }) =>
      supportConsultation(context.db, context.viewer, input).catch(
        asConsultationError,
      ),
    ),

  respond: impl.consultations.respond
    .use(moderator)
    .handler(({ context, input }) =>
      respondToConsultation(context.viewer, input).catch(asConsultationError),
    ),
};
