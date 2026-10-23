/**
 * Who is asking.
 *
 * Two kinds of caller: somebody browsing without an account, and a member.
 * Participation is progressive trust — a member who has proved they hold a
 * phone number or an email address can contribute; no identity document is
 * asked for. Staff authority is a separate, explicit grant (see
 * `permissions.ts`), never a consequence of anything the person edits.
 */
import type { MemberProfile } from "@/db/schema";

export type AnonymousViewer = { kind: "anonymous" };

export type MemberViewer = {
  kind: "member";
  userId: string;
  /** The account photo, if there is one. */
  image: string | null;
  profile: MemberProfile;
  /** Whether the account holds a verified phone number or email address. */
  contactVerified: boolean;
};

export type Viewer = AnonymousViewer | MemberViewer;

/**
 * Builds a viewer from an authenticated account and its profile.
 *
 * A session without a profile fails closed: the profile is created with the
 * account, so its absence means something is wrong, and the safe reading of
 * "something is wrong" is "no permissions".
 */
export function toViewer(
  userId: string,
  profile: MemberProfile | undefined,
  options: { image: string | null; contactVerified: boolean },
): Viewer {
  if (!profile) return { kind: "anonymous" };
  return {
    kind: "member",
    userId,
    image: options.image,
    profile,
    contactVerified: options.contactVerified,
  };
}
