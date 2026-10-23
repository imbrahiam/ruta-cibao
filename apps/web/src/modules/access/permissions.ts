/**
 * The two gates every mutation goes through.
 *
 * Splitting them is the whole point of the tier system: the contest asks the
 * platform to serve tourists too, so discovering, reviewing, uploading photos
 * and reporting traffic must work without a cédula. Voting, opening a
 * consultation and registering a business must not.
 */
import { ORPCError } from "@orpc/server";
import type { CitizenViewer, MemberViewer, Viewer } from "./viewer";

/**
 * A citizen who may act on other people's content, and where.
 *
 * `"all"` is the province administrator; a moderator carries the one
 * municipality they were appointed to. Carrying the scope on the viewer rather
 * than re-deriving it per procedure is what makes "did we check the
 * municipality" impossible to answer with "we forgot".
 */
export type ModeratorViewer = CitizenViewer & {
  scope: "all" | readonly string[];
};

/** Requires an account of any tier. Visitors pass. */
export function requireMember(viewer: Viewer): MemberViewer {
  if (viewer.kind === "anonymous") {
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in to continue." });
  }

  return viewer;
}

/**
 * Requires a verified cédula.
 *
 * The error distinguishes "you are not signed in" from "you are signed in but
 * have not verified", because the two send the reader to different screens and
 * a single 403 would strand a visitor with no way forward.
 */
export function requireCitizen(viewer: Viewer): CitizenViewer {
  const member = requireMember(viewer);

  if (member.kind !== "citizen") {
    throw new ORPCError("FORBIDDEN", {
      message: "This action is for verified residents.",
      data: {
        reason: "cedula_required",
        cedulaStatus: member.profile.cedulaStatus,
      },
    });
  }

  return member;
}

/**
 * Confines an action to the viewer's own municipality.
 *
 * An official in Monción must not moderate content from Sabaneta, and the
 * check lives here rather than in each procedure so adding a feature cannot
 * quietly skip it.
 */
export function requireMunicipalityScope(
  viewer: Viewer,
  municipalityId: string,
): CitizenViewer {
  const citizen = requireCitizen(viewer);

  if (citizen.profile.municipalityId !== municipalityId) {
    throw new ORPCError("FORBIDDEN", {
      message: "This content belongs to another municipality.",
      data: { reason: "municipality_scope" },
    });
  }

  return citizen;
}

/**
 * Requires moderation authority.
 *
 * Built on `requireCitizen`, not on `requireMember`: somebody deciding whether
 * a neighbour's clinic goes on the public map has a verified cédula behind
 * that decision, and the audit trail names them. It also guarantees a
 * `municipalityId`, which is what the scope is made of.
 */
export function requireModerator(viewer: Viewer): ModeratorViewer {
  const citizen = requireCitizen(viewer);
  const role = citizen.profile.staffRole;

  if (role === "none") {
    throw new ORPCError("FORBIDDEN", {
      message: "This action is for moderators.",
      data: { reason: "moderator_required" },
    });
  }

  return {
    ...citizen,
    scope: role === "admin" ? "all" : [citizen.profile.municipalityId],
  };
}

/** Whether a moderator may act on content belonging to a municipality. */
export function canModerate(
  viewer: ModeratorViewer,
  municipalityId: string,
): boolean {
  return viewer.scope === "all" || viewer.scope.includes(municipalityId);
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
