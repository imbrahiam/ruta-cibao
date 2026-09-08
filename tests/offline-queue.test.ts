import { afterEach, describe, expect, test } from "bun:test";
import { ORPCError } from "@orpc/client";
import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const { drainQueue } = await import("../src/lib/offline/flush");
const { enqueue, listPending, offlineDb } = await import(
  "../src/lib/offline/queue"
);

afterEach(async () => {
  await offlineDb().queue.clear();
});

const draft = (userId = "member-a") => ({
  userId,
  procedure: "places.report",
  input: { requestId: crypto.randomUUID() },
  idempotencyKey: crypto.randomUUID(),
  labelKey: "map.place.reportForm.queued",
});

describe("offline submissions", () => {
  test("replays in order and removes only acknowledged drafts", async () => {
    const first = await enqueue(draft());
    const second = await enqueue(draft());
    const sent: number[] = [];
    const result = await drainQueue("member-a", async (item) => {
      sent.push(item.id);
    });
    expect(sent).toEqual([first, second]);
    expect(result.sent).toBe(2);
    expect(await listPending()).toEqual([]);
  });

  test("keeps drafts after more than eight connection failures", async () => {
    await enqueue(draft());
    for (let attempt = 0; attempt < 10; attempt++)
      await drainQueue("member-a", async () => {
        throw new TypeError("Failed to fetch");
      });
    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.attempts).toBe(10);
    expect(pending[0]?.blocked).toBe(false);
  });

  test("never sends another account's draft or a legacy unowned draft", async () => {
    await enqueue(draft("member-b"));
    await offlineDb().queue.add({
      procedure: "places.submit",
      input: {},
      idempotencyKey: crypto.randomUUID(),
      labelKey: "old",
      attempts: 0,
      createdAt: Date.now(),
    });
    let calls = 0;
    await drainQueue("member-a", async () => {
      calls++;
    });
    expect(calls).toBe(0);
    expect(await listPending()).toHaveLength(2);
  });

  test("retains invalid drafts for review and continues independent submissions", async () => {
    const invalid = await enqueue(draft());
    await enqueue(draft());
    const result = await drainQueue("member-a", async (item) => {
      if (item.id === invalid) throw new ORPCError("BAD_REQUEST");
    });
    expect(result).toEqual({ sent: 1, failed: 0, blocked: 1 });
    expect((await listPending())[0]?.blocked).toBe(true);
  });

  test("stops on an expired session without deleting any draft", async () => {
    await enqueue(draft());
    await enqueue(draft());
    let calls = 0;
    await drainQueue("member-a", async () => {
      calls++;
      throw new ORPCError("UNAUTHORIZED");
    });
    expect(calls).toBe(1);
    expect(await listPending()).toHaveLength(2);
  });
});
