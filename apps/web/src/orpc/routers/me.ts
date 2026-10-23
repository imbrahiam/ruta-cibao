import { formatPhone } from "@ruta/shared/phone";
import { requireModerator } from "@/modules/access/permissions";
import { updateProfile } from "@/modules/access/profile";
import { impl, member } from "../base";

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
};
