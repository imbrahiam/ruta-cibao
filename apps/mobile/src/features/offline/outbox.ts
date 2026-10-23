import { ORPCError } from "@orpc/client";
import {
  type OpenConsultationInput,
  openConsultationInput,
  type ReportPlaceInput,
  type ReportTrafficInput,
  reportPlaceInput,
  reportTrafficInput,
  type SubmitPlaceInput,
  type SubmitRouteInput,
  submitPlaceInput,
  submitRouteInput,
} from "@ruta/contracts";
import { type ApiClient, createApiClient } from "@ruta/contracts/client";
import * as Network from "expo-network";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { z } from "zod";
import { useMe } from "@/features/auth/session";
import { api, orpc } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { API_ORIGIN } from "@/lib/config";
import { queryClient } from "@/lib/query";
import { getOfflineDb, withOfflineWrite } from "./db";

export const OUTBOX_PROCEDURES = [
  "places.submit",
  "traffic.report",
  "consultations.open",
  "places.report",
  "routes.submit",
] as const;

export type OutboxProcedure = (typeof OUTBOX_PROCEDURES)[number];

export type OutboxInputMap = {
  "places.submit": SubmitPlaceInput;
  "traffic.report": ReportTrafficInput;
  "consultations.open": OpenConsultationInput;
  "places.report": ReportPlaceInput;
  "routes.submit": SubmitRouteInput;
};

export type OutboxItem = {
  requestId: string;
  userId: string;
  procedure: OutboxProcedure;
  title: string;
  payload: unknown;
  observedAt: string | null;
  createdAt: number;
  attempts: number;
  blocked: boolean;
  lastError: string | null;
  errorReason: string | null;
};

export type FlushResult = {
  sent: number;
  failed: number;
  blocked: number;
  pausedReason?: "offline" | "unauthenticated" | "account_mismatch";
};

type OutboxRow = {
  request_id: string;
  user_id: string;
  procedure: string;
  title: string;
  payload_json: string;
  observed_at: string | null;
  created_at: number;
  attempts: number;
  blocked: number;
  last_error: string | null;
  error_reason: string | null;
};

/**
 * Server answers that will not succeed on automatic retry without user action.
 * `UNAUTHORIZED` is deliberately excluded: it means the session expired or
 * `x-expected-user-id` did not match, so the queue pauses until reauthenticated.
 */
const PERMANENT_ERRORS: Record<string, true> = {
  BAD_REQUEST: true,
  NOT_FOUND: true,
  FORBIDDEN: true,
  CONFLICT: true,
  UNPROCESSABLE_CONTENT: true,
  DUPLICATE_REPORT: true,
  MUNICIPALITY_MISMATCH: true,
};
/** Server traffic report TTL is 6 hours (`TRAFFIC_REPORT_TTL_MINUTES = 360`). */
const TRAFFIC_TTL_MS = 6 * 60 * 60 * 1_000;

type OutboxState = {
  items: OutboxItem[];
  flushing: boolean;
};

let outboxState: OutboxState = {
  items: [],
  flushing: false,
};

const listeners = new Set<() => void>();
let activeFlush: Promise<FlushResult> | undefined;
let watchersStarted = false;

function setOutboxState(patch: Partial<OutboxState>): void {
  outboxState = { ...outboxState, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

function isOutboxProcedure(value: string): value is OutboxProcedure {
  return (OUTBOX_PROCEDURES as readonly string[]).includes(value);
}

function rowToItem(row: OutboxRow): OutboxItem | null {
  if (!isOutboxProcedure(row.procedure)) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    return null;
  }
  return {
    requestId: row.request_id,
    userId: row.user_id,
    procedure: row.procedure,
    title: row.title,
    payload,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    attempts: row.attempts,
    blocked: row.blocked !== 0,
    lastError: row.last_error,
    errorReason: row.error_reason,
  };
}

/** Reloads all outbox rows from SQLite into the reactive store. */
export async function refreshOutboxState(): Promise<OutboxItem[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT request_id, user_id, procedure, title, payload_json, observed_at,
            created_at, attempts, blocked, last_error, error_reason
     FROM offline_outbox
     ORDER BY created_at ASC`,
  );
  const items: OutboxItem[] = [];
  for (const row of rows) {
    const item = rowToItem(row);
    if (item) items.push(item);
  }
  setOutboxState({ items });
  return items;
}

/** Lists queued outbox items for a specific account (or all accounts if omitted). */
export async function listOutboxItems(userId?: string): Promise<OutboxItem[]> {
  const all = await refreshOutboxState();
  return userId ? all.filter((item) => item.userId === userId) : all;
}

function validateOutboxPayload<P extends OutboxProcedure>(
  procedure: P,
  input: OutboxInputMap[P],
): {
  requestId: string;
  title: string;
  observedAt: string | null;
  validated: OutboxInputMap[P];
} {
  switch (procedure) {
    case "places.submit": {
      const parsed = submitPlaceInput.parse(input);
      return {
        requestId: parsed.requestId,
        title: parsed.name,
        observedAt: null,
        validated: parsed as OutboxInputMap[P],
      };
    }
    case "traffic.report": {
      const parsed = reportTrafficInput.parse(input);
      return {
        requestId: parsed.requestId,
        title: parsed.description?.trim() || parsed.categoryId,
        observedAt: parsed.observedAt,
        validated: parsed as OutboxInputMap[P],
      };
    }
    case "consultations.open": {
      const parsed = openConsultationInput.parse(input);
      return {
        requestId: parsed.requestId,
        title: parsed.title,
        observedAt: null,
        validated: parsed as OutboxInputMap[P],
      };
    }
    case "places.report": {
      const parsed = reportPlaceInput.parse(input);
      return {
        requestId: parsed.requestId,
        title: parsed.reason,
        observedAt: null,
        validated: parsed as OutboxInputMap[P],
      };
    }
    case "routes.submit": {
      const parsed = submitRouteInput.parse(input);
      return {
        requestId: parsed.requestId,
        title: parsed.name,
        observedAt: null,
        validated: parsed as OutboxInputMap[P],
      };
    }
  }
}

/**
 * Enqueues an idempotent contribution keyed by `(requestId, userId)` in the
 * encrypted SQLite outbox and attempts an immediate flush when online.
 */
export async function enqueueOutbox<P extends OutboxProcedure>(params: {
  userId: string;
  procedure: P;
  input: OutboxInputMap[P];
  title?: string;
}): Promise<OutboxItem> {
  const { requestId, title, observedAt, validated } = validateOutboxPayload(
    params.procedure,
    params.input,
  );
  const displayTitle = params.title?.trim() || title;
  const now = Date.now();

  await withOfflineWrite(async (db) => {
    const existing = await db.getFirstAsync<{ user_id: string }>(
      "SELECT user_id FROM offline_outbox WHERE request_id = ?",
      [requestId],
    );
    if (existing && existing.user_id !== params.userId) {
      throw new Error("Request ID belongs to a different account.");
    }
    if (existing) {
      await db.runAsync(
        `UPDATE offline_outbox
         SET title = ?, payload_json = ?, blocked = 0, last_error = NULL, error_reason = NULL
         WHERE request_id = ? AND user_id = ?`,
        [displayTitle, JSON.stringify(validated), requestId, params.userId],
      );
    } else {
      await db.runAsync(
        `INSERT INTO offline_outbox (
          request_id, user_id, procedure, title, payload_json, observed_at,
          created_at, attempts, blocked, last_error, error_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, NULL)`,
        [
          requestId,
          params.userId,
          params.procedure,
          displayTitle,
          JSON.stringify(validated),
          observedAt,
          now,
        ],
      );
    }
  });

  const items = await refreshOutboxState();
  const saved = items.find((item) => item.requestId === requestId);
  void flushOutbox(params.userId);
  return (
    saved ?? {
      requestId,
      userId: params.userId,
      procedure: params.procedure,
      title: displayTitle,
      payload: validated,
      observedAt,
      createdAt: now,
      attempts: 0,
      blocked: false,
      lastError: null,
      errorReason: null,
    }
  );
}

function createExpectedUserClient(userId: string): ApiClient {
  return createApiClient({
    origin: API_ORIGIN,
    headers: async (): Promise<Record<string, string>> => {
      const cookie = await authClient.getCookie();
      return {
        ...(cookie ? { cookie } : {}),
        "x-expected-user-id": userId,
      };
    },
  });
}

async function sendQueuedItem(
  client: ApiClient,
  item: OutboxItem,
): Promise<void> {
  switch (item.procedure) {
    case "places.submit":
      await client.places.submit(submitPlaceInput.parse(item.payload));
      return;
    case "traffic.report":
      await client.traffic.report(reportTrafficInput.parse(item.payload));
      return;
    case "consultations.open":
      await client.consultations.open(
        openConsultationInput.parse(item.payload),
      );
      return;
    case "places.report":
      await client.places.report(reportPlaceInput.parse(item.payload));
      return;
    case "routes.submit":
      await client.routes.submit(submitRouteInput.parse(item.payload));
      return;
  }
}

function extractErrorReason(error: unknown, code: string): string {
  if (error instanceof ORPCError) {
    const data: unknown = error.data;
    if (
      data &&
      typeof data === "object" &&
      "reason" in data &&
      typeof data.reason === "string"
    ) {
      return data.reason;
    }
  }
  if (code === "DUPLICATE_REPORT") return "duplicate";
  if (code === "MUNICIPALITY_MISMATCH") return "municipality_mismatch";
  return code.toLowerCase();
}

function isTrafficObservationStale(item: OutboxItem): boolean {
  if (item.procedure !== "traffic.report") return false;
  const iso = item.observedAt;
  if (!iso) return false;
  const observedMs = new Date(iso).getTime();
  if (!Number.isFinite(observedMs)) return true;
  return Date.now() - observedMs > TRAFFIC_TTL_MS;
}

/**
 * Single-flight drain of the active member's pending outbox items in FIFO order.
 *
 * - Verifies network connectivity first.
 * - Resolves current `me.get` to confirm the active session user.
 * - Sends `x-expected-user-id` on every request so a user switch mid-drain
 *   never files a contribution under another account.
 * - Blocks stale traffic observations (`> 6h`) without restamping `observedAt`.
 * - Marks permanent validation/conflict/forbidden errors as `blocked` and
 *   continues to independent items; pauses on network or auth errors.
 */
export function flushOutbox(expectedUserId?: string): Promise<FlushResult> {
  if (activeFlush) return activeFlush;

  activeFlush = (async (): Promise<FlushResult> => {
    const result: FlushResult = { sent: 0, failed: 0, blocked: 0 };

    const net = await Network.getNetworkStateAsync().catch(() => ({
      isConnected: false,
      isInternetReachable: false,
    }));
    if (net.isConnected === false || net.isInternetReachable === false) {
      result.pausedReason = "offline";
      return result;
    }

    setOutboxState({ flushing: true });
    try {
      let currentUserId: string;
      try {
        const me = await api.me.get();
        if (me.kind !== "member" || !me.userId) {
          result.pausedReason = "unauthenticated";
          return result;
        }
        currentUserId = me.userId;
      } catch (error) {
        if (error instanceof ORPCError && error.code === "UNAUTHORIZED") {
          result.pausedReason = "unauthenticated";
        } else {
          result.pausedReason = "offline";
        }
        return result;
      }

      if (expectedUserId && expectedUserId !== currentUserId) {
        result.pausedReason = "account_mismatch";
        return result;
      }

      const items = await listOutboxItems(currentUserId);
      const pending = items.filter((item) => !item.blocked);
      if (pending.length === 0) {
        return result;
      }

      const client = createExpectedUserClient(currentUserId);

      for (const item of pending) {
        if (isTrafficObservationStale(item)) {
          await withOfflineWrite(async (db) => {
            await db.runAsync(
              `UPDATE offline_outbox
               SET blocked = 1, attempts = attempts + 1, last_error = ?, error_reason = ?
               WHERE request_id = ? AND user_id = ?`,
              ["BAD_REQUEST", "stale_report", item.requestId, currentUserId],
            );
          });
          result.blocked += 1;
          await refreshOutboxState();
          continue;
        }

        try {
          await sendQueuedItem(client, item);
          await withOfflineWrite(async (db) => {
            await db.runAsync(
              "DELETE FROM offline_outbox WHERE request_id = ? AND user_id = ?",
              [item.requestId, currentUserId],
            );
          });
          result.sent += 1;
          await refreshOutboxState();
        } catch (error) {
          const code =
            error instanceof ORPCError ? error.code : "NETWORK_ERROR";

          if (code === "UNAUTHORIZED") {
            await withOfflineWrite(async (db) => {
              await db.runAsync(
                `UPDATE offline_outbox
                 SET attempts = attempts + 1, last_error = ?, error_reason = ?
                 WHERE request_id = ? AND user_id = ?`,
                [
                  "UNAUTHORIZED",
                  "unauthenticated",
                  item.requestId,
                  currentUserId,
                ],
              );
            });
            result.pausedReason = "unauthenticated";
            await refreshOutboxState();
            break;
          }

          const blocked =
            Boolean(PERMANENT_ERRORS[code]) || error instanceof z.ZodError;
          const reason =
            error instanceof z.ZodError
              ? "validation_failed"
              : extractErrorReason(error, code);

          await withOfflineWrite(async (db) => {
            await db.runAsync(
              `UPDATE offline_outbox
               SET blocked = ?, attempts = attempts + 1, last_error = ?, error_reason = ?
               WHERE request_id = ? AND user_id = ?`,
              [blocked ? 1 : 0, code, reason, item.requestId, currentUserId],
            );
          });
          await refreshOutboxState();

          if (blocked) {
            result.blocked += 1;
            continue;
          }

          result.failed += 1;
          break;
        }
      }

      if (result.sent > 0) {
        void queryClient.invalidateQueries({
          queryKey: orpc.places.contributions.key(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.traffic.active.key(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.consultations.browse.key(),
        });
      }

      return result;
    } finally {
      setOutboxState({ flushing: false });
    }
  })().finally(() => {
    activeFlush = undefined;
  });

  return activeFlush;
}

/**
 * Unblocks a specific item (unless it is an expired traffic observation) and
 * triggers a flush, or flushes all pending items when `requestId` is omitted.
 */
export async function retryOutboxItem(
  requestId?: string,
  userId?: string,
): Promise<FlushResult> {
  if (requestId) {
    const all = await refreshOutboxState();
    const target = all.find(
      (item) =>
        item.requestId === requestId && (!userId || item.userId === userId),
    );
    if (target && !isTrafficObservationStale(target)) {
      await withOfflineWrite(async (db) => {
        await db.runAsync(
          `UPDATE offline_outbox
           SET blocked = 0, last_error = NULL, error_reason = NULL
           WHERE request_id = ?`,
          [requestId],
        );
      });
      await refreshOutboxState();
    }
  }
  return flushOutbox(userId);
}

/** Removes one queued or blocked item from the outbox. */
export async function removeOutboxItem(
  requestId: string,
  userId?: string,
): Promise<void> {
  await withOfflineWrite(async (db) => {
    if (userId) {
      await db.runAsync(
        "DELETE FROM offline_outbox WHERE request_id = ? AND user_id = ?",
        [requestId, userId],
      );
    } else {
      await db.runAsync("DELETE FROM offline_outbox WHERE request_id = ?", [
        requestId,
      ]);
    }
  });
  await refreshOutboxState();
}

/**
 * Clears queued outbox rows for a deleted account (or all accounts when omitted)
 * without deleting the downloaded public offline snapshot.
 */
export async function clearOutboxForUser(userId?: string): Promise<void> {
  await withOfflineWrite(async (db) => {
    if (userId) {
      await db.runAsync("DELETE FROM offline_outbox WHERE user_id = ?", [
        userId,
      ]);
    } else {
      await db.runAsync("DELETE FROM offline_outbox");
    }
  });
  await refreshOutboxState();
}

function ensureOutboxWatchers(): void {
  if (watchersStarted) return;
  watchersStarted = true;

  void refreshOutboxState();

  AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      void flushOutbox();
    }
  });

  Network.addNetworkStateListener((event) => {
    if (event.isConnected && event.isInternetReachable !== false) {
      void flushOutbox();
    }
  });
}

/**
 * Reactive hook exposing the current account's outbox items, counts, and
 * enqueue / retry / remove actions, plus automatic reconnect/foreground flush.
 */
export function useOutbox() {
  const { me, signedIn } = useMe();
  const userId = signedIn && me?.kind === "member" ? me.userId : null;

  const store = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => outboxState,
  );

  useEffect(() => {
    ensureOutboxWatchers();
  }, []);

  useEffect(() => {
    if (userId) {
      void flushOutbox(userId);
    }
  }, [userId]);

  const items = userId
    ? store.items.filter((item) => item.userId === userId)
    : [];
  const pendingCount = items.filter((item) => !item.blocked).length;
  const blockedCount = items.filter((item) => item.blocked).length;

  const retry = useCallback(
    (requestId?: string) => retryOutboxItem(requestId, userId ?? undefined),
    [userId],
  );

  const remove = useCallback(
    (requestId: string) => removeOutboxItem(requestId, userId ?? undefined),
    [userId],
  );

  const enqueue = useCallback(
    <P extends OutboxProcedure>(
      procedure: P,
      input: OutboxInputMap[P],
      options?: { title?: string },
    ) => {
      if (!userId) {
        return Promise.reject(new Error("Sign-in required to enqueue."));
      }
      return enqueueOutbox({
        userId,
        procedure,
        input,
        title: options?.title,
      });
    },
    [userId],
  );

  return {
    items,
    pendingCount,
    blockedCount,
    totalCount: items.length,
    flushing: store.flushing,
    enqueue,
    flush: () => flushOutbox(userId ?? undefined),
    retry,
    remove,
  };
}
