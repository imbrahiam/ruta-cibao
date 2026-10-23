import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { categorySummary } from "./catalog";
import { mapPosition } from "./places";

/**
 * Opening a case with the ayuntamiento.
 *
 * The minimum length on the body is the one piece of validation here that is
 * about the product rather than the data. A case is read by a person who has to
 * act on it, and "el agua" is not something anybody can act on. Forty
 * characters is roughly one honest sentence.
 */
export const openConsultationInput = z.object({
  requestId: z.uuid(),
  categoryId: z.string().min(1).max(80),
  title: z.string().trim().min(8).max(120),
  body: z.string().trim().min(40).max(2_000),
  /**
   * The ayuntamiento the case is addressed to, chosen by the person. When a
   * point is given it must lie inside this municipality.
   */
  municipalityId: z.string().min(1).max(80),
  /** Optional: not every case is a point on a map. */
  location: mapPosition.optional(),
});

export type OpenConsultationInput = z.infer<typeof openConsultationInput>;

export const openConsultationOutput = z.object({
  id: z.string(),
  slug: z.string(),
  status: z.literal("open"),
});

export const consultationStatusSchema = z.enum([
  "open",
  "in_review",
  "answered",
  "resolved",
  "rejected",
]);

export const supportConsultationInput = z.object({
  consultationId: z.uuid(),
  /** The end state, not a toggle: a double tap on a slow line lands somewhere. */
  supported: z.boolean(),
});

export type SupportConsultationInput = z.infer<typeof supportConsultationInput>;

export const browseConsultationsInput = z.object({
  /** Empty means every municipality the reader can see. */
  municipality: z.string().max(80).default(""),
  category: z.string().max(80).default(""),
  status: consultationStatusSchema.optional(),
  /** The caller's own cases, for the account screen. */
  mine: z.boolean().default(false),
  offset: z.number().int().min(0).max(100_000).default(0),
  limit: z.number().int().min(1).max(48).default(12),
});

export type BrowseConsultationsInput = z.infer<typeof browseConsultationsInput>;

const consultationSummary = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  status: consultationStatusSchema,
  categoryId: z.string(),
  categoryName: z.string(),
  categoryIcon: z.string(),
  categoryColor: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  /** Display name, never an account id. */
  openedBy: z.string().nullable(),
  supportCount: z.number().int().nonnegative(),
  /** Whether the caller has added their voice. */
  supported: z.boolean(),
  responseCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  answeredAt: z.iso.datetime().nullable(),
});

export const browseConsultationsOutput = z.object({
  items: z.array(consultationSummary),
  total: z.number().int().nonnegative(),
});

export const consultationDetailOutput = consultationSummary.extend({
  body: z.string(),
  location: z.object({ lng: z.number(), lat: z.number() }).nullable(),
  isMine: z.boolean(),
  responses: z.array(
    z.object({
      id: z.string(),
      body: z.string(),
      author: z.string().nullable(),
      statusAfter: consultationStatusSchema,
      createdAt: z.iso.datetime(),
    }),
  ),
});

/**
 * The ayuntamiento's reply.
 *
 * `statusAfter` is required rather than inferred from the text: an official
 * writing "lo estamos viendo" and an official writing "ya está resuelto" are
 * two different promises, and the platform must not guess which one was made.
 */
export const respondConsultationInput = z.object({
  requestId: z.uuid(),
  consultationId: z.uuid(),
  body: z.string().trim().min(10).max(2_000),
  statusAfter: z.enum(["in_review", "answered", "resolved", "rejected"]),
});

export type RespondConsultationInput = z.infer<typeof respondConsultationInput>;

export const consultationSlugInput = z.object({ slug: z.string().min(1) });

export const supportConsultationOutput = z.object({
  supported: z.boolean(),
  supportCount: z.number().int().nonnegative(),
});

export const respondConsultationOutput = z.object({ status: z.literal("ok") });

export const consultationsContract = {
  /** The consultation taxonomy, for the form and the filter chips. */
  categories: oc
    .meta(
      openapi({
        method: "GET",
        path: "/consultations/categories",
        summary: "Consultation categories",
      }),
    )
    .output(z.array(categorySummary)),

  browse: oc
    .meta(
      openapi({
        method: "GET",
        path: "/consultations",
        summary: "Browse citizen cases",
      }),
    )
    .input(browseConsultationsInput)
    .output(browseConsultationsOutput),

  detail: oc
    .meta(
      openapi({
        method: "GET",
        path: "/consultations/{slug}",
        summary: "One case and its replies",
      }),
    )
    .input(consultationSlugInput)
    .output(consultationDetailOutput),

  open: oc
    .meta(
      openapi({
        method: "POST",
        path: "/consultations",
        successStatus: 201,
        summary: "Open a case with the ayuntamiento",
      }),
    )
    .errors({
      MUNICIPALITY_MISMATCH: {
        status: 422,
        message: "The point is in another municipality.",
        data: z.object({
          reason: z.literal("municipality_mismatch"),
          pointMunicipalityId: z.string(),
        }),
      },
    })
    .input(openConsultationInput)
    .output(openConsultationOutput),

  support: oc
    .meta(
      openapi({
        method: "POST",
        path: "/consultations/{consultationId}/support",
        summary: "Add or withdraw your voice",
      }),
    )
    .input(supportConsultationInput)
    .output(supportConsultationOutput),

  respond: oc
    .meta(
      openapi({
        method: "POST",
        path: "/consultations/{consultationId}/responses",
        successStatus: 201,
        summary: "Answer a case",
      }),
    )
    .input(respondConsultationInput)
    .output(respondConsultationOutput),
};
