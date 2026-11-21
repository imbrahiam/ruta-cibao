import { describe, expect, test } from "bun:test";
import path from "node:path";

/**
 * Every external dependency has a failure mode the product survives, and each
 * one is proved in a process configured to fail. A test that mocks the SDK
 * would prove the mock; these run the real module against a missing key, a
 * disabled provider or a dead endpoint.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== "1")("degradation", () => {
  const root = path.resolve(import.meta.dir, "../../..");
  const probe = path.join(root, "apps/web/tests/support/degradation-probe.ts");

  async function run(mode: string, overrides: Record<string, string>) {
    const child = Bun.spawn(["bun", probe, mode], {
      cwd: root,
      env: { ...process.env, ...overrides },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) {
      throw new Error(`probe ${mode} failed (${code}): ${stderr}`);
    }
    return JSON.parse(stdout.trim().split("\n").at(-1) ?? "{}") as Record<
      string,
      unknown
    >;
  }

  test("routing without a key refuses the request and names the reason", async () => {
    const result = await run("directions", {
      GOOGLE_MAPS_SERVER_API_KEY: "",
    });
    expect(result).toEqual({
      code: "SERVICE_UNAVAILABLE",
      reason: "unavailable",
    });
  }, 20_000);

  test("push without a provider token is skipped, not failed", async () => {
    // Both providers off: a machine with FCM configured would otherwise stay enabled.
    const result = await run("push", { APNS_KEY_ID: "", FCM_PROJECT_ID: "" });
    expect(result).toEqual({
      enabled: false,
      sent: 0,
      receipts: { checked: 0, disabled: 0 },
    });
  }, 20_000);

  test("email without a provider fails safely instead of logging a link", async () => {
    const result = await run("mail", {
      RESEND_API_KEY: "",
      AUTH_LOG_DELIVERY: "0",
    });
    expect(result.configured).toBe(false);
    expect(result.canDeliver).toBe(false);
    expect(String(result.error)).toContain("Email is not configured");
  }, 20_000);

  test("readiness turns a dead object store into a degraded answer", async () => {
    const result = await run("readiness", {
      S3_ENDPOINT: "http://127.0.0.1:1",
    });
    expect(result.status).toBe("degraded");
    expect(result.checks).toMatchObject({
      database: true,
      storage: false,
    });
  }, 20_000);

  test("readiness turns an unreachable database into a degraded answer", async () => {
    const result = await run("readiness", {
      DATABASE_URL: "postgresql://ruta:ruta@127.0.0.1:1/ruta_cibao_tests",
      PGCONNECT_TIMEOUT: "3",
    });
    expect(result.status).toBe("degraded");
    expect(result.checks).toMatchObject({ database: false });
  }, 20_000);

  test("a disabled geocoder returns no addresses and says so to the client", async () => {
    const result = await run("geocode", { GEOCODER: "none" });
    expect(result).toEqual({ enabled: false, results: [] });
  }, 20_000);

  test("a missing image-provider key leaves the thumbnail route at 404", async () => {
    const result = await run("thumbnail", {
      GOOGLE_MAPS_SERVER_API_KEY: "",
    });
    expect(result).toEqual({ status: 404 });
  }, 20_000);
});
