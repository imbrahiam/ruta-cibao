import { describe, expect, test } from "bun:test";
import { keyParam, renderNotification } from "@/i18n/open-keys";
import messages from "../messages/es.json";

/**
 * A notification stores a catalogue key, not a sentence, so the sentence only
 * exists at read time — which means a producer and the catalogue can drift apart
 * without anything failing. The result is not an error: it is a bell that says
 * `notifications.placeApproved` to a citizen.
 *
 * Every key a producer writes is asserted against the real catalogue here, and
 * against the shape of the key too: a stored key is a full path, and a
 * translator scoped to `notifications` would look for
 * `notifications.notifications.…` and find nothing.
 */

/** Every `messageKey` any producer in `src/modules` passes to `notify()`. */
const PRODUCED_KEYS = [
  "notifications.placeApproved",
  "notifications.placeRejected",
  "notifications.consultationAnswered",
  "notifications.consultationStatusChanged",
  "notifications.trafficNearby",
  "notifications.trafficRemoved",
  "notifications.cedulaVerified",
  "notifications.cedulaPending",
  "notifications.businessClaimApproved",
  "notifications.businessClaimRejected",
  "notifications.reportReady",
];

function lookup(key: string): string | undefined {
  const found = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      messages,
    );

  return typeof found === "string" ? found : undefined;
}

/** Stands in for next-intl: resolves a full path or renders the key itself. */
function translator(key: string, values?: Record<string, string | number>) {
  const template = lookup(key);
  if (template === undefined) return key;

  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    values && name in values ? String(values[name]) : whole,
  );
}

describe("the notification catalogue", () => {
  test("every key a producer writes exists", () => {
    const missing = PRODUCED_KEYS.filter((key) => lookup(key) === undefined);
    expect(missing).toEqual([]);
  });

  test("keys are full paths, so a scoped translator would miss them", () => {
    // The bug this guards: `getTranslations("notifications")` plus a stored
    // `notifications.placeApproved` resolves nothing, and every notification
    // renders as its own key.
    for (const key of PRODUCED_KEYS) {
      expect(key.startsWith("notifications.")).toBe(true);
      expect(lookup(key.replace(/^notifications\./, ""))).toBeUndefined();
    }
  });

  test("every state a consultation reply can leave a case in has a name", () => {
    for (const status of ["in_review", "answered", "resolved", "rejected"]) {
      expect(lookup(`consultations.status.${status}`)).toBeDefined();
    }
  });
});

describe("renderNotification", () => {
  test("fills a stored parameter into the sentence", () => {
    expect(
      renderNotification(translator, "notifications.placeApproved", {
        name: "Balneario La Peña",
      }),
    ).toBe("Aprobaron el lugar que subiste: Balneario La Peña");
  });

  test("resolves a parameter that is itself a catalogue key", () => {
    // The state's name is vocabulary, not data, so the row stores a key for it.
    expect(
      renderNotification(
        translator,
        "notifications.consultationStatusChanged",
        {
          title: "El agua no llega",
          status: keyParam("consultations.status.resolved"),
        },
      ),
    ).toBe("Tu caso «El agua no llega» pasó a resuelto");
  });

  test("leaves an ordinary parameter alone even when it reads like a key", () => {
    // A place really can be called this, and translating its name would be a
    // worse failure than the one the prefix exists to avoid.
    expect(
      renderNotification(translator, "notifications.placeApproved", {
        name: "consultations.status.open",
      }),
    ).toBe("Aprobaron el lugar que subiste: consultations.status.open");
  });

  test("a missing key renders as the key, loudly rather than as nothing", () => {
    expect(renderNotification(translator, "notifications.nope")).toBe(
      "notifications.nope",
    );
  });
});
