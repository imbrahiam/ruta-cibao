import { describe, expect, test } from "bun:test";
import { inviteCode } from "@ruta/contracts";
import {
  type Counts,
  INVITE_POINTS_CAP,
  POINTS,
  score,
} from "@/modules/reputation/scoring";

const none: Counts = {
  place: 0,
  route: 0,
  consultation: 0,
  traffic: 0,
  confirmation: 0,
  stamp: 0,
  support: 0,
  invite: 0,
  stampTowns: 0,
};

describe("reputation score", () => {
  test("a new account starts as a vecino with nothing earned", () => {
    const result = score(none);
    expect(result.points).toBe(0);
    expect(result.rank).toBe("vecino");
    expect(result.next).toEqual({ id: "explorador", pointsToGo: 25 });
    expect(result.badges.every((badge) => !badge.earned)).toBe(true);
  });

  test("points add up per kind and decide the rank at each threshold", () => {
    // 2 places (20) + 1 stamp (3) + 2 supports (2) = 25: exactly Explorador.
    const result = score({ ...none, place: 2, stamp: 1, support: 2 });
    expect(result.points).toBe(25);
    expect(result.rank).toBe("explorador");
    expect(result.next).toEqual({ id: "guia", pointsToGo: 50 });
    expect(result.breakdown.find((line) => line.kind === "place")).toEqual({
      kind: "place",
      count: 2,
      each: POINTS.place,
      points: 20,
    });
  });

  test("the top rank has nothing next", () => {
    const result = score({ ...none, route: 10 });
    expect(result.rank).toBe("leyenda");
    expect(result.next).toBeNull();
    expect(result.ranks.at(-1)).toEqual({ id: "leyenda", min: 150, max: null });
  });

  test("invites stop adding points past the cap, but still count", () => {
    const result = score({ ...none, invite: INVITE_POINTS_CAP + 5 });
    const line = result.breakdown.find((entry) => entry.kind === "invite");
    expect(line?.count).toBe(INVITE_POINTS_CAP + 5);
    expect(line?.points).toBe(INVITE_POINTS_CAP * POINTS.invite);
  });

  test("badges report capped progress and flip when the target is met", () => {
    const result = score({ ...none, stamp: 3, stampTowns: 3, consultation: 1 });
    const badge = (id: string) => result.badges.find((b) => b.id === id);
    expect(badge("traveller")).toEqual({
      id: "traveller",
      earned: false,
      current: 3,
      target: 5,
    });
    expect(badge("threeTowns")?.earned).toBe(true);
    expect(badge("civicVoice")?.earned).toBe(true);
    expect(badge("firstContribution")?.earned).toBe(true);
  });
});

describe("invite code input", () => {
  test("accepts any case and surrounding spaces, stored upper case", () => {
    expect(inviteCode.parse(" a1b2c3d4 ")).toBe("A1B2C3D4");
  });
  test("rejects anything that is not 8 hex characters", () => {
    for (const bad of ["A1B2C3D", "A1B2C3D4E", "G1B2C3D4", "A1B2-3D4"]) {
      expect(inviteCode.safeParse(bad).success).toBe(false);
    }
  });
});
