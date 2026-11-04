import { describe, expect, test } from "bun:test";
import { createConnectionLimiter } from "@/lib/connection-limit";

describe("connection limiter", () => {
  test("caps one client without affecting another", () => {
    const limiter = createConnectionLimiter({ perClient: 2, total: 10 });
    expect(limiter.acquire("a")).toBe(true);
    expect(limiter.acquire("a")).toBe(true);
    expect(limiter.acquire("a")).toBe(false);
    expect(limiter.acquire("b")).toBe(true);
    expect(limiter.active).toBe(3);
  });

  test("caps the process even when every client is within its own allowance", () => {
    const limiter = createConnectionLimiter({ perClient: 2, total: 3 });
    expect(limiter.acquire("a")).toBe(true);
    expect(limiter.acquire("b")).toBe(true);
    expect(limiter.acquire("c")).toBe(true);
    expect(limiter.acquire("d")).toBe(false);
  });

  test("a released slot is reusable, and over-release cannot underflow", () => {
    const limiter = createConnectionLimiter({ perClient: 1, total: 2 });
    expect(limiter.acquire("a")).toBe(true);
    limiter.release("a");
    expect(limiter.active).toBe(0);
    limiter.release("a");
    expect(limiter.active).toBe(0);
    expect(limiter.acquire("a")).toBe(true);
  });
});
