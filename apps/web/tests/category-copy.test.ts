import { describe, expect, test } from "bun:test";
import { categoryIconNames, categoryKinds } from "@ruta/contracts";
import messages from "@ruta/shared/messages/es.json";

// The categories desk names kinds and glyphs through keys built at runtime
// (`t(kind)`, `t(\`iconNames.${name}\`)`), which no type check can follow: a
// list in the contract that grows, or a catalogue key that moves, shows the raw
// key on screen instead ("admin.route" on the Ruta tab, 2026-11-20).
const admin = messages.admin as Record<string, unknown>;

describe("category copy", () => {
  test("every category kind has its desk label", () => {
    for (const kind of categoryKinds.options) {
      expect(typeof admin[kind], `admin.${kind}`).toBe("string");
    }
  });

  test("every category icon has a Spanish name", () => {
    const names = admin.iconNames as Record<string, unknown>;
    for (const icon of categoryIconNames) {
      expect(typeof names[icon], `admin.iconNames.${icon}`).toBe("string");
    }
  });
});
