import { isCompletePhone } from "@ruta/shared/phone";
import { z } from "zod";

const publicPhone = z
  .string()
  .trim()
  .max(24)
  .refine((value) => !value || isCompletePhone(value), {
    message: "business.form.invalidPhone",
  })
  .default("");
export const businessContact = z.object({
  contactPhone: publicPhone,
  whatsapp: publicPhone,
  openingHours: z.string().trim().max(240).default(""),
});
export type BusinessContact = z.infer<typeof businessContact>;
export const updateBusinessInput = businessContact.extend({
  requestId: z.uuid(),
  placeId: z.uuid(),
});

/**
 * Claiming a business that is already on the map.
 *
 * There is no "register a business" input here, and that is the design: a
 * business is a place with a `business` category, submitted through the same
 * form and the same queue as everything else. What this adds is the second
 * question — whose it is — because that is the part the map cannot answer on
 * its own.
 */
export const claimBusinessInput = z.object({
  requestId: z.uuid(),
  placeId: z.uuid(),
  /** How they can show it is theirs. An RNC, a name on the sign, a description. */
  evidence: z.string().trim().min(20).max(600),
  /** Dominican mobile or landline, as people write it. Normalised server-side. */
  contactPhone: publicPhone,
  whatsapp: publicPhone,
  openingHours: z.string().trim().max(240).optional(),
});

export type ClaimBusinessInput = z.infer<typeof claimBusinessInput>;

export const claimBusinessOutput = z.object({
  id: z.string(),
  status: z.literal("pending"),
});

export const decideClaimInput = z
  .object({
    requestId: z.uuid(),
    claimId: z.uuid(),
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    // Turning down somebody's claim to their own livelihood without a sentence
    // is how a civic platform loses the businesses it wants on the map.
    if (value.decision === "reject" && (value.note?.length ?? 0) < 10) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "moderation.noteRequired",
      });
    }
  });

export type DecideClaimInput = z.infer<typeof decideClaimInput>;

/** What the place drawer needs to decide which button to show. */
export const businessClaimStateOutput = z.object({
  /** Whether this place is a business at all. */
  claimable: z.boolean(),
  /** Whether it already has an owner. */
  claimed: z.boolean(),
  /** Whether the caller is that owner. */
  mine: z.boolean(),
  /** Whether the caller has a claim waiting for a decision. */
  pending: z.boolean(),
  /** Published contact details, once a claim is approved. */
  contactPhone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  openingHours: z.string().nullable(),
});

export const pendingClaimShape = z.object({
  id: z.string(),
  placeId: z.string(),
  placeName: z.string(),
  placeSlug: z.string(),
  categoryName: z.string(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  evidence: z.string(),
  contactPhone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  openingHours: z.string().nullable(),
  claimedBy: z.string().nullable(),
  claimantTier: z.enum(["visitor", "citizen"]).nullable(),
  createdAt: z.iso.datetime(),
});
