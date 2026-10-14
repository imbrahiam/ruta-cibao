import { describe, expect, test } from "bun:test";
import type { MemberProfile } from "@/db/schema";
import { toViewer } from "@/modules/access/viewer";

function profile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: "p1",
    userId: "u1",
    tier: "visitor",
    staffRole: "none",
    displayName: "Vecino",
    municipalityId: null,
    cedulaCiphertext: null,
    cedulaBlindIndex: null,
    cedulaStatus: "none",
    residencyDeclaredAt: null,
    verifiedFullName: null,
    claimedName: null,
    cedulaClaimedAt: null,
    verifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("toViewer", () => {
  test("no profile means no account", () => {
    expect(toViewer("u1", undefined).kind).toBe("anonymous");
  });

  test("a plain account is a visitor", () => {
    expect(toViewer("u1", profile()).kind).toBe("visitor");
  });

  test("a fully verified profile is a citizen", () => {
    const viewer = toViewer(
      "u1",
      profile({
        tier: "citizen",
        cedulaStatus: "verified",
        municipalityId: "sabaneta",
        verifiedFullName: "JUAN PEREZ",
      }),
    );

    expect(viewer.kind).toBe("citizen");
  });

  // The registry goes down, and a profile can sit mid-verification. Those
  // accounts keep working as visitors; what they must not do is vote.
  test("a citizen tier without a completed verification is still a visitor", () => {
    for (const partial of [
      {
        tier: "citizen" as const,
        cedulaStatus: "pending" as const,
        municipalityId: "sabaneta",
        verifiedFullName: "X",
      },
      {
        tier: "citizen" as const,
        cedulaStatus: "unavailable" as const,
        municipalityId: "sabaneta",
        verifiedFullName: "X",
      },
      {
        tier: "citizen" as const,
        cedulaStatus: "verified" as const,
        municipalityId: null,
        verifiedFullName: "X",
      },
      {
        tier: "citizen" as const,
        cedulaStatus: "verified" as const,
        municipalityId: "sabaneta",
        verifiedFullName: null,
      },
    ]) {
      expect(toViewer("u1", profile(partial)).kind).toBe("visitor");
    }
  });
});
