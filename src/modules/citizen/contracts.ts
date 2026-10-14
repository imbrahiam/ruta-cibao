import { z } from "zod";
import { cedulaSchema } from "@/lib/jce";

/**
 * Onboarding input. The cédula shape comes from `@/lib/jce`, which owns that
 * definition, so the API and the registry client can never disagree about what
 * a valid cédula looks like.
 */
export const verifyCedulaInput = z.object({
  cedula: cedulaSchema,
  /** The name as the person uses it; compared with the registry's, never shown back unless it matches. */
  name: z.string().trim().min(3, "validation.cedula.name").max(120),
  municipalityId: z.string().min(1),
  /** Set when the person has looked again at a number whose check digit fails, and stands by it. */
  confirmNumber: z.boolean().default(false),
});

/** Every value `member_profiles.cedula_status` can hold, for API outputs. */
export const cedulaStatusSchema = z.enum([
  "none",
  "pending",
  "verified",
  "unavailable",
  "rejected",
  "matched",
  "in_review",
]);

export type VerifyCedulaInput = z.infer<typeof verifyCedulaInput>;

export const verifyCedulaOutput = z.object({
  /**
   * `matched`    the registry found it; the next step is the photos
   * `pending`    the registry could not answer; a retry job will finish it,
   *              and the photos can be sent meanwhile
   * `in_review`  photos already with the municipality; nothing changed
   * `verified`   already a verified resident; nothing changed
   * `rejected`   the registry has no such cédula, or not with that name —
   *              one answer for both, so the form cannot be used to learn
   *              which numbers exist
   * `taken`      that cédula already belongs to another account
   * `check_digit` the number fails its check digit; nothing was looked up
   */
  status: z.enum([
    "verified",
    "matched",
    "in_review",
    "pending",
    "rejected",
    "taken",
    "check_digit",
  ]),
  fullName: z.string().nullable(),
  retryAfterSeconds: z.number().int().nullable(),
});
