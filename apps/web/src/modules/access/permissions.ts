/**
 * The gates every mutation goes through.
 *
 * `requireMember` is participation: a signed-in account with a verified phone
 * or email. `requireModerator` is authority: an explicit staff grant whose
 * scope comes from the staff-only municipality column, never from the
 * municipality a person picks for themselves.
 */
import { ORPCError } from "@orpc/server";
import type { MemberViewer, Viewer } from "./viewer";

/**
 * A member who may act on other people's content, and where.
 *
 * `"all"` is the province administrator; a moderator carries the one
 * municipality they were appointed to.
 */
export type ModeratorViewer = MemberViewer & {
  scope: "all" | readonly string[];
};

/**
 * Requires a signed-in account with a verified contact.
 *
 * The two failures are distinct because they lead to different screens:
 * signing in, or confirming a phone number or email.
 */
export function requireMember(viewer: Viewer): MemberViewer {
  if (viewer.kind === "anonymous") {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in to continue." });
  }
  if (!viewer.contactVerified) {
    throw new ORPCError("FORBIDDEN", {
      message: "Verify a phone number or email address to continue.",
      data: { reason: "contact_verification_required" },
    });
  }
  return viewer;
}

/** Requires moderation authority, with its scope. */
export function requireModerator(viewer: Viewer): ModeratorViewer {
  const member = requireMember(viewer);
  const { staffRole, staffMunicipalityId } = member.profile;

  if (staffRole === "admin") return { ...member, scope: "all" };
  // The database requires an assignment for a moderator; refusing here as
  // well keeps a missing one from ever reading as "no restriction".
  if (staffRole === "moderator" && staffMunicipalityId) {
    return { ...member, scope: [staffMunicipalityId] };
  }

  throw new ORPCError("FORBIDDEN", {
    message: "This action is for moderators.",
    data: { reason: "moderator_required" },
  });
}

/** Whether a moderator may act on content belonging to a municipality. */
export function canModerate(
  viewer: ModeratorViewer,
  municipalityId: string,
): boolean {
  return viewer.scope === "all" || viewer.scope.includes(municipalityId);
}

/** Whether a member's staff grant covers a municipality, without throwing. */
export function hasStaffAuthority(
  viewer: MemberViewer,
  municipalityId: string,
): boolean {
  const { staffRole, staffMunicipalityId } = viewer.profile;
  if (staffRole === "admin") return true;
  return staffRole === "moderator" && staffMunicipalityId === municipalityId;
}

/** The same check, as a gate. */
export function assertModerates(
  viewer: ModeratorViewer,
  municipalityId: string,
): void {
  if (canModerate(viewer, municipalityId)) return;

  throw new ORPCError("FORBIDDEN", {
    message: "This content belongs to another municipality.",
    data: { reason: "municipality_scope" },
  });
}
