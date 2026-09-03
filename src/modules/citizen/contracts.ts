import { z } from "zod";
import { cedulaSchema } from "@/lib/jce";

/**
 * Onboarding input. The cédula shape comes from `@/lib/jce`, which owns that
 * definition, so the API and the registry client can never disagree about what
 * a valid cédula looks like.
 */
export const verifyCedulaInput = z.object({
  cedula: cedulaSchema,
  municipalityId: z.string().min(1),
});

export type VerifyCedulaInput = z.infer<typeof verifyCedulaInput>;

export const verifyCedulaOutput = z.object({
  /**
   * `verified`  the account is now a citizen
   * `pending`   the registry could not answer; a retry job will finish it
   * `rejected`  no such cédula
   * `taken`     that cédula already belongs to another account
   */
  status: z.enum(["verified", "pending", "rejected", "taken"]),
  fullName: z.string().nullable(),
  retryAfterSeconds: z.number().int().nullable(),
});
