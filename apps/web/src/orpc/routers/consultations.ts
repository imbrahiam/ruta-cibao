import { openapi } from "@orpc/openapi";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { categories } from "@/db/schema";
import {
  browseConsultationsInput,
  browseConsultationsOutput,
  consultationDetailOutput,
  openConsultationInput,
  openConsultationOutput,
  respondConsultationInput,
  supportConsultationInput,
} from "@/modules/consultations/contracts";
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
import { citizenProcedure, moderatorProcedure, pub } from "../base";

/**
 * Citizen consultations, as an API.
 *
 * The tier split is the whole shape of this router and it is worth reading in
 * one glance: anybody may read a case, only a verified resident may open one or
 * add their voice, and only an official may answer. Nothing here re-checks
 * that — the procedure builder each entry is attached to is the check, so a new
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
  categories: pub
    .meta(
      openapi({
        method: "GET",
        path: "/consultations/categories",
        summary: "Consultation categories",
      }),
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          icon: z.string(),
          color: z.string(),
        }),
      ),
    )
    .handler(({ context }) =>
      context.db
        .select({
          id: categories.id,
          name: categories.name,
          icon: categories.icon,
          color: categories.color,
        })
        .from(categories)
        .where(
          and(
            eq(categories.kind, "consultation"),
            eq(categories.isActive, true),
          ),
        )
        .orderBy(categories.sortOrder),
    ),

  browse: pub
    .meta(
      openapi({
        method: "GET",
        path: "/consultations",
        summary: "Browse citizen cases",
      }),
    )
    .input(browseConsultationsInput)
    .output(browseConsultationsOutput)
    .handler(async ({ context, input }) =>
      browseConsultations(context.db, await context.getViewer(), input),
    ),

  detail: pub
    .meta(
      openapi({
        method: "GET",
        path: "/consultations/{slug}",
        summary: "One case and its replies",
      }),
    )
    .input(z.object({ slug: z.string().min(1) }))
    .output(consultationDetailOutput)
    .handler(async ({ context, input }) =>
      consultationDetail(
        context.db,
        await context.getViewer(),
        input.slug,
      ).catch(asConsultationError),
    ),

  open: citizenProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/consultations",
        successStatus: 201,
        summary: "Open a case with the ayuntamiento",
      }),
    )
    .input(openConsultationInput)
    .output(openConsultationOutput)
    .handler(({ context, input }) =>
      openConsultation(context.viewer, input).catch(asConsultationError),
    ),

  support: citizenProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/consultations/{consultationId}/support",
        summary: "Add or withdraw your voice",
      }),
    )
    .input(supportConsultationInput)
    .output(
      z.object({
        supported: z.boolean(),
        supportCount: z.number().int().nonnegative(),
      }),
    )
    .handler(({ context, input }) =>
      supportConsultation(context.db, context.viewer, input).catch(
        asConsultationError,
      ),
    ),

  respond: moderatorProcedure
    .meta(
      openapi({
        method: "POST",
        path: "/consultations/{consultationId}/responses",
        successStatus: 201,
        summary: "Answer a case",
      }),
    )
    .input(respondConsultationInput)
    .output(z.object({ status: z.literal("ok") }))
    .handler(({ context, input }) =>
      respondToConsultation(context.viewer, input).catch(asConsultationError),
    ),
};
