import { describe, expect, test } from "bun:test";
import { displayNameFromRegistry, stageOf } from "@/modules/identity/stage";

describe("resident verification stages", () => {
  test("a registry match never grants verified status", () => {
    expect(stageOf("matched", "visitor", null)).toBe("documents");
    expect(stageOf("pending", "visitor", null)).toBe("documents");
    expect(stageOf("verified", "visitor", "approved")).toBe("cedula");
  });
  test("only a verified citizen has completed the flow", () => {
    expect(stageOf("verified", "citizen", "approved")).toBe("verified");
    expect(stageOf("in_review", "visitor", "pending")).toBe("review");
    expect(stageOf("in_review", "visitor", "rejected")).toBe("documents");
    expect(stageOf("rejected", "visitor", "rejected")).toBe("cedula");
  });
  test("registry names retain accents and surname particles", () => {
    expect(displayNameFromRegistry("  MARÍA ALTAGRACIA DE LOS SANTOS  ")).toBe(
      "María Altagracia de los Santos",
    );
  });
});
