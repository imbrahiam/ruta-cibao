"use client";

import Dexie, { type EntityTable } from "dexie";
import { uuid } from "@/lib/uuid";
import { requestBackgroundSync } from "./background-sync";

/**
 * Mutations waiting for a signal.
 *
 * Santiago Rodríguez is rural and coverage is patchy. Someone standing at a
 * washed-out bridge should be able to report it, put the phone away, and have
 * it arrive when they get back to town — not lose the report because the
 * request failed.
 *
 * IndexedDB rather than localStorage: this must survive the tab being closed,
 * hold more than a few kilobytes, and be readable from a service worker.
 *
 * Every item carries an idempotency key generated when it is queued, not when
 * it is sent. That is the whole point: the same key on every retry is what lets
 * the server recognise a duplicate rather than create a second report.
 */
export type QueuedMutation = {
  id: number;
  /** Missing only for legacy drafts; these must never be sent as a new user. */
  userId?: string;
  blocked?: boolean;
  /** Dotted path into the oRPC router, e.g. `traffic.report`. */
  procedure: string;
  input: unknown;
  idempotencyKey: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  /** A short catalogue key describing the action, for the pending list. */
  labelKey: string;
};

const db = new Dexie("ruta-cibao-offline") as Dexie & {
  queue: EntityTable<QueuedMutation, "id">;
};

db.version(1).stores({ queue: "++id, createdAt, procedure" });
db.version(2).stores({ queue: "++id, createdAt, procedure, userId" });

export function offlineDb() {
  return db;
}

export async function enqueue(
  item: Omit<QueuedMutation, "id" | "createdAt" | "attempts"> & {
    userId: string;
  },
): Promise<number> {
  const id = await db.queue.add({
    ...item,
    createdAt: Date.now(),
    attempts: 0,
  });
  // So the browser sends it when signal returns, even with the app closed.
  void requestBackgroundSync();
  return id;
}

export function pendingCount(): Promise<number> {
  return db.queue.count();
}

export function listPending(): Promise<QueuedMutation[]> {
  return db.queue.orderBy("createdAt").toArray();
}

export async function forget(id: number): Promise<void> {
  await db.queue.delete(id);
}

export async function recordFailure(
  id: number,
  error: string,
  blocked = false,
): Promise<void> {
  const item = await db.queue.get(id);
  if (!item) return;
  await db.queue.update(id, {
    attempts: item.attempts + 1,
    lastError: error,
    blocked,
  });
}

/** Generated when queued, so every retry of the same action carries it. */
export function newIdempotencyKey(): string {
  return uuid();
}
