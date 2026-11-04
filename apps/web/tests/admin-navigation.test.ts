import { describe, expect, test } from "bun:test";
import { resolveMunicipalityFilter } from "@/components/admin/list-queries";
import { findAdminSection } from "@/components/admin/nav";

describe("administrative municipality filters", () => {
  test("missing and empty municipality filters leave the authorized view unrestricted", () => {
    expect(
      resolveMunicipalityFilter(new URLSearchParams(), "all"),
    ).toBeUndefined();
    expect(
      resolveMunicipalityFilter(new URLSearchParams("municipality="), "all"),
    ).toBeUndefined();
  });

  test("a single assigned municipality cannot be overridden by the URL", () => {
    expect(
      resolveMunicipalityFilter(new URLSearchParams("municipality=sabaneta"), [
        "moncion",
      ]),
    ).toBe("moncion");
  });

  test("multiple assigned municipalities retain the destination filter or combined view", () => {
    const scope = ["moncion", "sabaneta"];
    expect(
      resolveMunicipalityFilter(
        new URLSearchParams("municipality=sabaneta"),
        scope,
      ),
    ).toBe("sabaneta");
    expect(
      resolveMunicipalityFilter(new URLSearchParams(), scope),
    ).toBeUndefined();
  });
});

describe("administrative wayfinding", () => {
  test("weekly report records and correction queues resolve to different sections", () => {
    expect(findAdminSection("/admin/reports/report-1")?.href).toBe(
      "/admin/reports",
    );
    expect(findAdminSection("/admin/queue/reports")?.href).toBe(
      "/admin/queue/reports",
    );
  });

  test("consultation records and their publication queue share the consultation section", () => {
    expect(findAdminSection("/admin/consultations/camino-local")?.href).toBe(
      "/admin/consultations",
    );
    expect(findAdminSection("/admin/queue/consultations")?.href).toBe(
      "/admin/consultations",
    );
  });

  test("partial path prefixes and unknown admin pages do not select an unrelated section", () => {
    expect(findAdminSection("/admin/reports-archive")).toBeUndefined();
    expect(findAdminSection("/admin/unknown")).toBeUndefined();
  });
});
