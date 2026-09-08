/**
 * Who is asking.
 *
 * The platform serves three kinds of people and the difference matters on
 * almost every mutation, so it is modelled as a union rather than a pile of
 * nullable fields. There is no way to hold a `CitizenViewer` without a verified
 * cédula, which is what keeps "one cédula, one vote" from depending on whoever
 * remembered to write the check.
 *
 *   anonymous  browsing without an account
 *   visitor    signed in, no cédula — a tourist or someone from the diaspora
 *   citizen    signed in with a verified cédula
 */
import type { MemberProfile } from "@/db/schema";

export type AnonymousViewer = { kind: "anonymous" };

export type VisitorViewer = {
  kind: "visitor";
  userId: string;
  /** The identity provider's photo (Google), if there is one. */
  image: string | null;
  profile: MemberProfile;
};

export type CitizenViewer = {
  kind: "citizen";
  userId: string;
  /** The identity provider's photo (Google), if there is one. */
  image: string | null;
  profile: MemberProfile & { municipalityId: string; verifiedFullName: string };
};

export type MemberViewer = VisitorViewer | CitizenViewer;
export type Viewer = AnonymousViewer | MemberViewer;

/**
 * Builds a viewer from a profile.
 *
 * A profile only counts as a citizen when the verification actually completed.
 * A row sitting at `pending` or `unavailable` is still a visitor: it can
 * discover, review and report, but not vote — which is the degradation the
 * civil registry's downtime is allowed to cause, and the worst one.
 */
export function toViewer(
  userId: string,
  profile: MemberProfile | undefined,
  image: string | null = null,
): Viewer {
  if (!profile) return { kind: "anonymous" };

  if (
    profile.tier === "citizen" &&
    profile.cedulaStatus === "verified" &&
    profile.municipalityId !== null &&
    profile.verifiedFullName !== null
  ) {
    return {
      kind: "citizen",
      userId,
      image,
      profile: {
        ...profile,
        municipalityId: profile.municipalityId,
        verifiedFullName: profile.verifiedFullName,
      },
    };
  }

  return { kind: "visitor", userId, image, profile };
}
