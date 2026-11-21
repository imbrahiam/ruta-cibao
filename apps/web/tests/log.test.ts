import { expect, test } from "bun:test";
import { errorDetails, logError, logInfo, logWarn } from "@/lib/log";

type Output = { stdout: string[]; stderr: string[] };

function capture(run: () => void): Output {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (line: unknown) => {
    stdout.push(String(line));
  };
  console.error = (line: unknown) => {
    stderr.push(String(line));
  };
  try {
    run();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  return { stdout, stderr };
}

function record(line: string): Record<string, unknown> {
  const parsed = JSON.parse(line) as Record<string, unknown>;
  expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  return parsed;
}

test("one event is one parseable JSON line", () => {
  const output = capture(() =>
    logInfo("place.published", { placeId: "abc", status: "pending" }),
  );
  expect(output.stdout).toHaveLength(1);
  const parsed = record(output.stdout[0] ?? "");
  expect(parsed.level).toBe("info");
  expect(parsed.event).toBe("place.published");
  expect(parsed.placeId).toBe("abc");
  expect(parsed.status).toBe("pending");
});

test("fields that name personal data are redacted at any depth", () => {
  const output = capture(() =>
    logInfo("account.updated", {
      email: "person@example.com",
      nested: { password: "hunter2", sessionToken: "abc" },
      authorization: "Bearer secret",
    }),
  );
  const parsed = record(output.stdout[0] ?? "");
  expect(parsed.email).toBe("[redacted]");
  expect(parsed.authorization).toBe("[redacted]");
  expect(parsed.nested).toEqual({
    password: "[redacted]",
    sessionToken: "[redacted]",
  });
});

test("an address in a harmless field is redacted by its shape", () => {
  const output = capture(() =>
    logInfo("mail.code_logged", {
      to: "person@example.com",
      message: "Write to person@example.com for help.",
      phoneValue: "809-555-1212",
    }),
  );
  const parsed = record(output.stdout[0] ?? "");
  expect(parsed.to).toBe("[redacted]");
  expect(parsed.message).toBe("Write to [redacted] for help.");
  expect(parsed.phoneValue).toBe("[redacted]");
});

test("ordinary numbers and dates are not mistaken for phone numbers", () => {
  const output = capture(() =>
    logInfo("report.generated", {
      period: "2026-10-28",
      count: "408",
      slug: "hospital-quiribamba",
    }),
  );
  const parsed = record(output.stdout[0] ?? "");
  expect(parsed.period).toBe("2026-10-28");
  expect(parsed.count).toBe("408");
  expect(parsed.slug).toBe("hospital-quiribamba");
});

test("long strings and deep objects stay bounded", () => {
  const output = capture(() =>
    logInfo("batch.failed", {
      text: "x".repeat(2_100),
      deep: { a: { b: { c: { d: { e: "too deep" } } } } },
    }),
  );
  const parsed = record(output.stdout[0] ?? "");
  expect(String(parsed.text).endsWith("…")).toBe(true);
  expect(String(parsed.text).length).toBe(2_001);
  expect(JSON.stringify(parsed)).toContain("[depth]");
});

test("errors keep a stack, and errors and warnings choose the right stream", () => {
  const error = new TypeError("boom");
  const output = capture(() => {
    logWarn("jobs.queue_unavailable", errorDetails(error));
    logError("rpc.failed", errorDetails(error));
  });
  expect(output.stdout).toHaveLength(1);
  expect(output.stderr).toHaveLength(1);
  const warning = record(output.stdout[0] ?? "");
  const failure = record(output.stderr[0] ?? "");
  expect(warning.level).toBe("warn");
  expect(failure.level).toBe("error");
  expect(failure.name).toBe("TypeError");
  expect(failure.message).toBe("boom");
  expect(String(failure.stack)).toContain("TypeError: boom");
  expect(errorDetails("not an error")).toEqual({ message: "not an error" });
});
