import { z } from "zod";
import { cedulaStatusSchema } from "@/modules/citizen/contracts";

/**
 * The photos a request carries.
 *
 *   front      the front of the cédula, all four corners in view
 *   selfie     the person holding that cédula next to their face
 *   residence  optional: a utility bill or a letter from the junta de vecinos,
 *              for when the cédula alone does not settle where somebody lives
 */
export const IDENTITY_DOCUMENT_KINDS = [
  "front",
  "selfie",
  "residence",
] as const;
export const identityDocumentKind = z.enum(IDENTITY_DOCUMENT_KINDS);
export type IdentityDocumentKind = z.infer<typeof identityDocumentKind>;

/**
 * Generous for a phone photo that the page has already resized to 1600 px,
 * and still enough for an original when the browser could not resize it.
 */
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

export const IDENTITY_REVIEW_REASONS = [
  "unreadable",
  "mismatch",
  "not_resident",
  "incomplete",
  "other",
] as const;
export const identityReviewReason = z.enum(IDENTITY_REVIEW_REASONS);

/**
 * Where a person is in becoming a verified resident, as one word the screens
 * can switch on — derived from the profile and the latest request rather than
 * stored, so it can never disagree with them.
 *
 *   cedula     nothing usable yet: enter the cédula (again, if it was not found)
 *   documents  the cédula is on file; send the photos (again, if refused)
 *   review     photos with the municipality
 *   verified   done
 */
export const verificationStage = z.enum([
  "cedula",
  "documents",
  "review",
  "verified",
]);
export type VerificationStage = z.infer<typeof verificationStage>;

export const verificationStatusOutput = z.object({
  stage: verificationStage,
  cedulaStatus: cedulaStatusSchema,
  /** The name on the cédula, from the registry. Null until it has answered. */
  registryName: z.string().nullable(),
  municipality: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** The most recent request, open or decided. */
  review: z
    .object({
      id: z.string(),
      status: z.enum(["pending", "approved", "rejected"]),
      submittedAt: z.iso.datetime(),
      reviewedAt: z.iso.datetime().nullable(),
      reason: identityReviewReason.nullable(),
      note: z.string().nullable(),
    })
    .nullable(),
});
export type VerificationStatus = z.infer<typeof verificationStatusOutput>;

export const reviewListInput = z.object({
  status: z.enum(["pending", "decided"]).default("pending"),
  limit: z.number().int().min(1).max(50).default(20),
});

export const reviewSummary = z.object({
  id: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
  registryName: z.string().nullable(),
  displayName: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  submittedAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().nullable(),
  reason: identityReviewReason.nullable(),
  hasResidence: z.boolean(),
  documentsAvailable: z.boolean(),
  /** How many earlier requests from the same person were turned down. */
  previousRejections: z.number().int(),
});
export type ReviewSummary = z.infer<typeof reviewSummary>;

export const decideReviewInput = z.discriminatedUnion("decision", [
  z.object({
    reviewId: z.uuid(),
    decision: z.literal("approve"),
    /** A reviewer may correct the municipality, within their own scope. */
    municipalityId: z.string().min(1).optional(),
  }),
  z.object({
    reviewId: z.uuid(),
    decision: z.literal("reject"),
    reason: identityReviewReason,
    note: z.string().trim().max(500).optional(),
  }),
]);
export type DecideReviewInput = z.infer<typeof decideReviewInput>;

export class IdentityError extends Error {
  constructor(
    readonly reason:
      | "already_verified"
      | "already_submitted"
      | "cedula_required"
      | "invalid_file"
      | "missing_file"
      | "too_many"
      | "not_found"
      | "not_pending"
      | "own_request"
      | "registry_pending"
      | "out_of_scope",
    readonly detail?: string,
  ) {
    super(reason);
    this.name = "IdentityError";
  }
}
