import { describe, expect, test } from "bun:test";
import { ORPCError } from "@orpc/server";
import type { MemberProfile } from "@/db/schema";
import { requireMember, requireModerator } from "@/modules/access/permissions";
import { toViewer, type Viewer } from "@/modules/access/viewer";

function profile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "p1",
    userId: "u1",
    staffRole: "none",
    displayName: "Vecino AB12",
    municipalityId: null,
    staffMunicipalityId: null,
    residencyVerifiedAt: null,
    residencyVerifiedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function member(
  overrides: Partial<MemberProfile> = {},
  contactVerified = true,
): Viewer {
  return toViewer("u1", profile(overrides), { image: null, contactVerified });
}

function rejection(run: () => unknown): ORPCError<string, unknown> {
  try {
    run();
  } catch (error) {
    if (error instanceof ORPCError) return error;
    throw error;
  }
  throw new Error("expected a rejection");
}

describe("toViewer", () => {
  test("a session without a profile fails closed", () => {
    expect(
      toViewer("u1", undefined, { image: null, contactVerified: true }).kind,
    ).toBe("anonymous");
  });
});

describe("requireMember", () => {
  test("signed out is UNAUTHORIZED", () => {
    expect(rejection(() => requireMember({ kind: "anonymous" })).code).toBe(
      "UNAUTHORIZED",
    );
  });

  test("an account without a verified contact is FORBIDDEN with a reason", () => {
    const error = rejection(() => requireMember(member({}, false)));
    expect(error.code).toBe("FORBIDDEN");
    expect(error.data).toEqual({ reason: "contact_verification_required" });
  });

  test("a verified contact is enough; no resident badge is required", () => {
    expect(requireMember(member()).userId).toBe("u1");
  });
});

describe("requireModerator", () => {
  test("scope comes from the staff assignment, not the personal municipality", () => {
    const viewer = requireModerator(
      member({
        staffRole: "moderator",
        staffMunicipalityId: "moncion",
        municipalityId: "sabaneta",
      }),
    );
    expect(viewer.scope).toEqual(["moncion"]);
  });

  test("a moderator without an assignment is refused, never province-wide", () => {
    const error = rejection(() =>
      requireModerator(
        member({ staffRole: "moderator", municipalityId: "sabaneta" }),
      ),
    );
    expect(error.code).toBe("FORBIDDEN");
  });

  test("an admin has province-wide scope", () => {
    expect(requireModerator(member({ staffRole: "admin" })).scope).toBe("all");
  });

  test("staff without a verified contact are refused", () => {
    expect(
      rejection(() => requireModerator(member({ staffRole: "admin" }, false)))
        .code,
    ).toBe("FORBIDDEN");
  });

  test("an ordinary member is refused", () => {
    expect(rejection(() => requireModerator(member())).data).toEqual({
      reason: "moderator_required",
    });
  });
});
