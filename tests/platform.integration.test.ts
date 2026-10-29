import { beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { POST as reportClientError } from "@/app/api/client-errors/route";
import { GET as health } from "@/app/api/health/route";
import { GET as offlineSnapshot } from "@/app/api/offline/snapshots/[version]/route";
import { GET as thumbnail } from "@/app/api/places/[id]/thumbnail/route";
import { db } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
import { readiness, readinessResponse } from "@/modules/platform/readiness";
import { assertDedicatedLocalDatabase } from "./support/test-db";

/**
 * The platform edges a phone or an operator meets before any feature code:
 * liveness, readiness, the crash sink, the image redirect and the offline
 * artifact. None of them may turn a provider failure into a hung request, and
 * the crash sink must accept a report without becoming a second copy of the
 * data the app protects.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== "1")("platform edges", () => {
  const origin = "http://localhost:3000";

  beforeEach(async () => {
    assertDedicatedLocalDatabase();
    // The limiter persists across runs; a full bucket from an earlier run
    // would turn the first request of this one into a false 429.
    await db
      .delete(rateLimitBuckets)
      .where(eq(rateLimitBuckets.scope, "client-error"));
  });

  test("liveness answers without touching a dependency", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("readiness reports every dependency and maps the answer to 200 or 503", async () => {
    const response = readinessResponse(await readiness());
    const body = (await response.json()) as {
      status: "ok" | "degraded";
      checks: { database: boolean; storage: boolean; worker: boolean };
    };

    expect(body.checks.database).toBe(true);
    const healthy =
      body.checks.database && body.checks.storage && body.checks.worker;
    expect(body.status).toBe(healthy ? "ok" : "degraded");
    expect(response.status).toBe(healthy ? 200 : 503);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const degraded = readinessResponse({
      status: "degraded",
      checks: { database: true, storage: false, worker: true },
    });
    expect(degraded.status).toBe(503);
    expect(await degraded.json()).toEqual({
      status: "degraded",
      checks: { database: true, storage: false, worker: true },
    });
  });

  test("a client error is accepted, logged as one JSON line, and never stored", async () => {
    const lines: string[] = [];
    const original = process.stderr.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      lines.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    let response: Response;
    try {
      response = await reportClientError(
        new Request(`${origin}/api/client-errors`, {
          method: "POST",
          headers: { "x-request-id": "req-123" },
          body: JSON.stringify({
            message: "Cannot read property 'id' of undefined",
            platform: "android",
            appVersion: "0.1.0",
            route: "/place/[slug]",
          }),
        }),
      );
    } finally {
      process.stderr.write = original;
    }

    expect(response.status).toBe(204);
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(record.event).toBe("client.error");
    expect(record.requestId).toBe("req-123");
    expect(record.platform).toBe("android");
  });

  test("a malformed or oversized report is refused", async () => {
    const malformed = await reportClientError(
      new Request(`${origin}/api/client-errors`, {
        method: "POST",
        body: "{ not json",
      }),
    );
    expect(malformed.status).toBe(400);

    const invalid = await reportClientError(
      new Request(`${origin}/api/client-errors`, {
        method: "POST",
        body: JSON.stringify({ message: "" }),
      }),
    );
    expect(invalid.status).toBe(400);

    const oversized = await reportClientError(
      new Request(`${origin}/api/client-errors`, {
        method: "POST",
        body: JSON.stringify({ message: "x".repeat(9_000) }),
      }),
    );
    expect(oversized.status).toBe(413);
  });

  test("the crash sink stops accepting after its hourly allowance", async () => {
    const send = () =>
      reportClientError(
        new Request(`${origin}/api/client-errors`, {
          method: "POST",
          headers: { "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify({}),
        }),
      );

    for (let index = 0; index < 30; index += 1) {
      expect((await send()).status).toBe(400);
    }
    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  test("an invalid thumbnail id and an unknown snapshot are 404, not errors", async () => {
    const badId = await thumbnail(
      new Request(`${origin}/api/places/not-a-uuid/thumbnail`),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(badId.status).toBe(404);

    const missing = await offlineSnapshot(
      new Request(`${origin}/api/offline/snapshots/nope`),
      { params: Promise.resolve({ version: "nope" }) },
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });
  });
});
