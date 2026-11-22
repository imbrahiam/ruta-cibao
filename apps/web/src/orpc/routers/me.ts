import { ORPCError } from "@orpc/server";
import { formatPhone } from "@ruta/shared/phone";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { requireModerator } from "@/modules/access/permissions";
import { updateProfile } from "@/modules/access/profile";
import { updateProfilePhoto } from "@/modules/access/profile-photo";
import {
  accountDeletionStatus,
  requestAccountDeletion,
} from "@/modules/account/deletion";
import { impl, member } from "../base";

/** Receipts are unguessable UUIDs, but the lookup is public: bound it anyway. */
const RECEIPT_LOOKUPS = {
  scope: "deletion-receipt",
  limit: 60,
  windowMs: 60_000,
};

export const meRouter = {
  get: impl.me.get.handler(async ({ context }) => {
    const { viewer, contact } = await context.getSession();

    if (viewer.kind === "anonymous" || !contact) {
      return {
        kind: "anonymous" as const,
        userId: null,
        displayName: null,
        image: null,
        municipalityId: null,
        contactVerified: false,
        residencyVerified: false,
        phoneVerified: false,
        emailVerified: false,
        phoneNumber: null,
        email: null,
        staffRole: "none" as const,
        staffScope: null,
      };
    }

    const { profile } = viewer;
    let staffScope: "all" | string[] | null = null;
    if (profile.staffRole !== "none" && viewer.contactVerified) {
      try {
        const scope = requireModerator(viewer).scope;
        staffScope = scope === "all" ? "all" : [...scope];
      } catch {
        staffScope = null;
      }
    }

    return {
      kind: "member" as const,
      userId: viewer.userId,
      displayName: profile.displayName,
      image: viewer.image,
      municipalityId: profile.municipalityId,
      contactVerified: viewer.contactVerified,
      residencyVerified: profile.residencyVerifiedAt !== null,
      phoneVerified: contact.phoneVerified,
      emailVerified: contact.emailVerified,
      phoneNumber: contact.phoneNumber
        ? formatPhone(contact.phoneNumber)
        : null,
      email: contact.email,
      staffRole: profile.staffRole,
      staffScope,
    };
  }),

  updateProfile: impl.me.updateProfile
    .use(member)
    .handler(({ context, input }) => updateProfile(context.viewer, input)),

  updatePhoto: impl.me.updatePhoto
    .use(member)
    .handler(({ context, input }) => updateProfilePhoto(context.viewer, input)),

  requestDeletion: impl.me.requestDeletion
    .use(member)
    .handler(async ({ context, input }) => {
      const { session } = await context.getSession();
      if (!session) throw new ORPCError("UNAUTHORIZED");
      return requestAccountDeletion(context.viewer, session, input);
    }),

  /** Public: the receipt is the credential, and it reveals nothing but a status. */
  deletionStatus: impl.me.deletionStatus.handler(async ({ context, input }) => {
    const allowance = await consumeRateLimit(
      getRequestClientKey(context.headers),
      RECEIPT_LOOKUPS,
    );
    if (!allowance.allowed) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many lookups. Try again shortly.",
        data: { reason: "rate_limited" },
      });
    }
    return accountDeletionStatus(input.deletionId);
  }),
};
