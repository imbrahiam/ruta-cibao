import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

export const staffRoleSchema = z.enum(["none", "moderator", "admin"]);

/**
 * Who the caller is, as the app needs to know it.
 *
 * Contact details are the caller's own and only theirs: a phone-only account's
 * internal placeholder email never appears, and nothing here identifies
 * anyone else.
 */
export const meOutput = z.object({
  kind: z.enum(["anonymous", "member"]),
  userId: z.string().nullable(),
  displayName: z.string().nullable(),
  image: z.string().nullable(),
  /** The municipality the person chose as theirs; editable, no authority. */
  municipalityId: z.string().nullable(),
  /** A verified phone or email: what participation requires. */
  contactVerified: z.boolean(),
  /** The optional in-person municipal resident badge. */
  residencyVerified: z.boolean(),
  phoneVerified: z.boolean(),
  emailVerified: z.boolean(),
  /** The caller's own number, `809-555-0101`. */
  phoneNumber: z.string().nullable(),
  /** The caller's own deliverable address. */
  email: z.string().nullable(),
  staffRole: staffRoleSchema,
  /** `"all"` for a province admin, the assigned municipality for a moderator. */
  staffScope: z.union([z.literal("all"), z.array(z.string())]).nullable(),
});

export type MeOutput = z.infer<typeof meOutput>;

export const updateProfileInput = z.object({
  requestId: z.uuid(),
  displayName: z.string().trim().min(2).max(80),
  municipalityId: z.string().min(1).max(80).nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileInput>;

export const okOutput = z.object({ status: z.literal("ok") });

export const meContract = {
  get: oc
    .meta(
      openapi({ method: "GET", path: "/me", summary: "The current viewer" }),
    )
    .output(meOutput),

  updateProfile: oc
    .meta(
      openapi({
        method: "PATCH",
        path: "/me",
        summary: "Update your display name and municipality",
      }),
    )
    .input(updateProfileInput)
    .output(okOutput),
};
