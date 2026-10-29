import { describe, expect, test } from "bun:test";
import { declaresTest, unmarkedCatchBodies } from "../scripts/quality-rules";

/**
 * The quality gate is only as good as its rules. These prove the two rules
 * reject the failure they exist for: a promise whose test was renamed into a
 * comment, and an empty catch that hides its error.
 */
describe("quality gate rules", () => {
  test("a real declaration counts, but a comment and a skipped test do not", () => {
    const source = `
      // test("a shadow promise", () => {});
      test.skip("a skipped promise", () => {});
      it("a real promise", async () => {});
    `;

    expect(declaresTest(source, "a real promise")).toBe(true);
    expect(declaresTest(source, "a shadow promise")).toBe(false);
    expect(declaresTest(source, "a skipped promise")).toBe(false);
  });

  test("a title that only appears in a block comment is not evidence", () => {
    const source = `
      /*
      test("a promise that no longer runs", () => {});
      */
      test("another promise", () => {});
    `;

    expect(declaresTest(source, "a promise that no longer runs")).toBe(false);
    expect(declaresTest(source, "another promise")).toBe(true);
  });

  test("an empty catch is reported, and a marked or non-empty one is not", () => {
    const source = `function silent() {
  try {
    return 1;
  } catch {
  }
}

function marked() {
  try {
    return 1;
  } catch {
    // expected: the value is optional.
  }
}

function handled() {
  try {
    return 1;
  } catch {
    return 0;
  }
}`;

    const found = unmarkedCatchBodies(source);
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(4);
    expect(found[0]?.body).toBe("");
  });
});
