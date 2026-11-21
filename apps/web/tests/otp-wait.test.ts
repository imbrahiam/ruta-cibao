import { expect, test } from "bun:test";
import {
  formatCountdown,
  secondsLeft,
  waitFromFailure,
} from "@/lib/web/otp-wait";

test("reads the wait the server asked for", () => {
  expect(
    waitFromFailure({ code: "OTP_RATE_LIMITED", status: 429, retryAfter: 42 }),
  ).toBe(42);
  expect(waitFromFailure({ code: "OTP_RATE_LIMITED", retryAfter: 2.2 })).toBe(
    3,
  );
});

test("a refusal without a time waits the usual minute", () => {
  expect(waitFromFailure({ status: 429 })).toBe(60);
  expect(waitFromFailure({ code: "TOO_MANY_REQUESTS", retryAfter: "x" })).toBe(
    60,
  );
});

test("other failures are not waits", () => {
  expect(waitFromFailure({ code: "INVALID_OTP", status: 400 })).toBeNull();
  expect(
    waitFromFailure({ code: "TOO_MANY_ATTEMPTS", status: 403 }),
  ).toBeNull();
  expect(waitFromFailure(null)).toBeNull();
});

test("counts down in whole seconds and never below zero", () => {
  expect(secondsLeft(10_500, 10_000)).toBe(1);
  expect(secondsLeft(10_000, 12_000)).toBe(0);
  expect(secondsLeft(undefined, 0)).toBe(0);
});

test("formats minutes and padded seconds", () => {
  expect(formatCountdown(42)).toBe("0:42");
  expect(formatCountdown(65)).toBe("1:05");
  expect(formatCountdown(720)).toBe("12:00");
  expect(formatCountdown(0)).toBe("0:00");
});
