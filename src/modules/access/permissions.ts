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
