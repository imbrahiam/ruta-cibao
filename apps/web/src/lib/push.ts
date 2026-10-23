/** Expo acceptance and provider receipts are not a human read acknowledgement. */
import { appTargetHref, parseAppTarget } from "@ruta/shared/app-target";
import { catalogues } from "@ruta/shared/messages";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  lte,
  notExists,
  or,
} from "drizzle-orm";
import { createTranslator } from "next-intl";
import { z } from "zod";
import { type DbTransaction, db } from "@/db";
import {
  nativePushDevices,
  nativePushTickets,
  notifications,
} from "@/db/schema";
import { routing } from "@/i18n/routing";
import { recordAudit } from "@/lib/audit";
import { decryptSensitive } from "@/lib/crypto";
import { env } from "@/lib/env";

const SEND_BATCH_SIZE = 100;
const RECEIPT_BATCH_SIZE = 1_000;
const REQUEST_TIMEOUT_MS = 10_000;
const RECEIPT_DELAY_MS = 15 * 60_000;
const RECEIPT_RETRY_MS = 5 * 60_000;
const RECEIPT_LIFETIME_MS = 24 * 60 * 60_000;
const PERMANENT_ERRORS = ["DeviceNotRegistered", "MessageTooBig"];
const providerErrorCodes = new Set([
  ...PERMANENT_ERRORS,
  "MessageRateExceeded",
  "MismatchSenderId",
  "InvalidCredentials",
]);

const providerFailure = z.object({
  status: z.literal("error"),
  message: z.string().optional(),
  details: z.object({ error: z.string().optional() }).optional(),
});
const ticketSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), id: z.string().min(1).max(256) }),
  providerFailure,
]);
const receiptSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok") }),
  providerFailure,
]);
const requestErrors = z
  .array(z.object({ code: z.string(), message: z.string().optional() }))
  .optional();
const sendResponseSchema = z.object({
  data: z.array(ticketSchema).max(SEND_BATCH_SIZE).optional(),
  errors: requestErrors,
});
const receiptResponseSchema = z.object({
  data: z
    .record(z.string(), receiptSchema)
    .refine((receipts) => Object.keys(receipts).length <= RECEIPT_BATCH_SIZE)
    .optional(),
  errors: requestErrors,
});

type ExpoTicket = z.infer<typeof ticketSchema>;
type Device = Pick<
  typeof nativePushDevices.$inferSelect,
  "installationId" | "tokenHash" | "tokenCiphertext"
>;

export type PushPayload = { notificationId: string; href?: string };

export function isPushEnabled(): boolean {
  return Boolean(env.EXPO_PUSH_ACCESS_TOKEN);
}

/** Provider text can contain tokens; only known error codes leave this boundary. */
function errorCode(value: string | undefined): string {
  return value && providerErrorCodes.has(value)
    ? value
    : "UnknownProviderError";
}

function canonicalTarget(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const app = new URL(env.APP_URL);
    const url = new URL(href, app);
    if (
      url.origin !== app.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return undefined;
    const target = parseAppTarget(url.pathname);
    return target && appTargetHref(target) === url.pathname
      ? url.pathname
      : undefined;
  } catch {
    return undefined;
  }
}

async function requestExpo<T>(
  operation: "send" | "getReceipts",
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const accessToken = env.EXPO_PUSH_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Native push is not configured");

  let response: Response;
  let reply: unknown;
  try {
    response = await fetch(`https://exp.host/--/api/v2/push/${operation}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "error",
    });
    reply = await response.json();
  } catch {
    throw new Error(`Expo ${operation} request failed`);
  }
  const parsed = schema.safeParse(reply);
  if (!parsed.success) throw new Error(`Invalid Expo ${operation} response`);
  if (!response.ok)
    throw new Error(
      `Expo ${operation} request failed (HTTP ${response.status})`,
    );
  return parsed.data;
}

async function disableDevice(
  tx: DbTransaction,
  installationId: string,
  tokenHash: string,
  ticketId: string,
): Promise<number> {
  const disabled = await tx
    .update(nativePushDevices)
    .set({ enabled: false, updatedAt: new Date() })
    .where(
      and(
        eq(nativePushDevices.installationId, installationId),
        eq(nativePushDevices.tokenHash, tokenHash),
        eq(nativePushDevices.enabled, true),
      ),
    )
    .returning({ installationId: nativePushDevices.installationId });
  if (disabled.length)
    await recordAudit(
      {
        action: "native_push.device.disabled",
        subjectType: "native_push_device",
        subjectId: installationId,
        metadata: { reason: "DeviceNotRegistered", ticketId },
      },
      tx,
    );
  return disabled.length;
}

async function storeTicket(
  tx: DbTransaction,
  notificationId: string,
  device: Device,
  ticket: ExpoTicket,
): Promise<{ accepted: number; retry: boolean }> {
  const code =
    ticket.status === "error" ? errorCode(ticket.details?.error) : null;
  const outcome = {
    expoTicketId: ticket.status === "ok" ? ticket.id : null,
    status: ticket.status === "ok" ? ("pending" as const) : ("error" as const),
    errorCode: code,
    checkAfter: new Date(Date.now() + RECEIPT_DELAY_MS),
    updatedAt: new Date(),
  };
  const [stored] = await tx
    .insert(nativePushTickets)
    .values({
      notificationId,
      installationId: device.installationId,
      tokenHash: device.tokenHash,
      ...outcome,
    })
    .onConflictDoUpdate({
      target: [
        nativePushTickets.notificationId,
        nativePushTickets.installationId,
        nativePushTickets.tokenHash,
      ],
      set: outcome,
    })
    .returning({ id: nativePushTickets.id });
  if (!stored) throw new Error("Could not persist native push ticket");
  await recordAudit(
    {
      action:
        ticket.status === "ok"
          ? "native_push.ticket.accepted"
          : "native_push.ticket.rejected",
      subjectType: "native_push_ticket",
      subjectId: stored.id,
      metadata: { notificationId, status: outcome.status, errorCode: code },
    },
    tx,
  );
  if (code === "DeviceNotRegistered")
    await disableDevice(tx, device.installationId, device.tokenHash, stored.id);
  return {
    accepted: ticket.status === "ok" ? 1 : 0,
    retry: code !== null && !PERMANENT_ERRORS.includes(code),
  };
}

/** Retry only devices whose notification has not already been accepted by Expo. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!isPushEnabled()) {
    console.info("native_push.send.skipped");
    return 0;
  }
  const notificationId = z.uuid().parse(payload.notificationId);
  const catalogue = createTranslator({
    locale: routing.defaultLocale,
    messages: catalogues[routing.defaultLocale],
  });
  const href = canonicalTarget(payload.href);
  const data = { notificationId, ...(href ? { href } : {}) };
  const devices = await db
    .select({ installationId: nativePushDevices.installationId })
    .from(nativePushDevices)
    .where(
      and(
        eq(nativePushDevices.userId, userId),
        eq(nativePushDevices.enabled, true),
      ),
    )
    .orderBy(asc(nativePushDevices.installationId));

  let accepted = 0;
  let retry = false;
  for (let offset = 0; offset < devices.length; offset += SEND_BATCH_SIZE) {
    const installationIds = devices
      .slice(offset, offset + SEND_BATCH_SIZE)
      .map((device) => device.installationId);
    // Each batch commits independently: a later failure must not resend its predecessors.
    const result = await db.transaction(async (tx) => {
      const [notification] = await tx
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId),
          ),
        )
        .for("update");
      if (!notification) return { accepted: 0, retry: false };
      const pending = await tx
        .select({
          installationId: nativePushDevices.installationId,
          tokenHash: nativePushDevices.tokenHash,
          tokenCiphertext: nativePushDevices.tokenCiphertext,
        })
        .from(nativePushDevices)
        .where(
          and(
            inArray(nativePushDevices.installationId, installationIds),
            eq(nativePushDevices.userId, userId),
            eq(nativePushDevices.enabled, true),
            notExists(
              tx
                .select({ id: nativePushTickets.id })
                .from(nativePushTickets)
                .where(
                  and(
                    eq(nativePushTickets.notificationId, notificationId),
                    eq(
                      nativePushTickets.installationId,
                      nativePushDevices.installationId,
                    ),
                    eq(
                      nativePushTickets.tokenHash,
                      nativePushDevices.tokenHash,
                    ),
                    or(
                      isNotNull(nativePushTickets.expoTicketId),
                      and(
                        eq(nativePushTickets.status, "error"),
                        inArray(nativePushTickets.errorCode, PERMANENT_ERRORS),
                      ),
                    ),
                  ),
                ),
            ),
          ),
        )
        .orderBy(asc(nativePushDevices.installationId))
        .for("update");
      if (!pending.length) return { accepted: 0, retry: false };
      const response = await requestExpo(
        "send",
        pending.map((device) => ({
          to: decryptSensitive(device.tokenCiphertext),
          title: catalogue("notifications.title"),
          body: catalogue("notifications.pushGeneric"),
          sound: "default",
          data,
        })),
        sendResponseSchema,
      );
      if (
        response.errors?.length ||
        !response.data ||
        response.data.length !== pending.length
      )
        throw new Error("Expo rejected native push batch");
      let batchAccepted = 0;
      let batchRetry = false;
      for (const [index, ticket] of response.data.entries()) {
        const device = pending[index];
        if (!device) throw new Error("Invalid Expo native push ticket count");
        const stored = await storeTicket(tx, notificationId, device, ticket);
        batchAccepted += stored.accepted;
        batchRetry ||= stored.retry;
      }
      return { accepted: batchAccepted, retry: batchRetry };
    });
    accepted += result.accepted;
    retry ||= result.retry;
  }
  if (retry) throw new Error("Native push delivery incomplete");
  return accepted;
}

/** Poll accepted tickets after fifteen minutes, in provider-sized batches. */
export async function checkNativePushReceipts(): Promise<{
  checked: number;
  disabled: number;
}> {
  if (!isPushEnabled()) return { checked: 0, disabled: 0 };
  let checked = 0;
  let disabled = 0;
  let retry = false;
  for (;;) {
    const result = await db.transaction(async (tx) => {
      const tickets = await tx
        .select()
        .from(nativePushTickets)
        .where(
          and(
            eq(nativePushTickets.status, "pending"),
            isNotNull(nativePushTickets.expoTicketId),
            lte(nativePushTickets.checkAfter, new Date()),
          ),
        )
        .orderBy(asc(nativePushTickets.checkAfter), asc(nativePushTickets.id))
        .limit(RECEIPT_BATCH_SIZE)
        .for("update", { skipLocked: true });
      if (!tickets.length) return { checked: 0, disabled: 0, retry: false };
      const response = await requestExpo(
        "getReceipts",
        {
          ids: tickets.flatMap((ticket) =>
            ticket.expoTicketId ? [ticket.expoTicketId] : [],
          ),
        },
        receiptResponseSchema,
      );
      if (response.errors?.length || !response.data)
        throw new Error("Expo rejected native push receipt batch");
      let batchDisabled = 0;
      let batchRetry = false;
      for (const ticket of tickets) {
        const receipt = ticket.expoTicketId
          ? response.data[ticket.expoTicketId]
          : undefined;
        const expired =
          Date.now() - ticket.createdAt.getTime() >= RECEIPT_LIFETIME_MS;
        const code =
          receipt?.status === "error"
            ? errorCode(receipt.details?.error)
            : !receipt && expired
              ? "ReceiptNotFound"
              : null;
        const status = receipt?.status ?? (expired ? "error" : "pending");
        await tx
          .update(nativePushTickets)
          .set({
            status,
            errorCode: code,
            checkAfter: new Date(Date.now() + RECEIPT_RETRY_MS),
            updatedAt: new Date(),
          })
          .where(eq(nativePushTickets.id, ticket.id));
        await recordAudit(
          {
            action: receipt
              ? "native_push.receipt.checked"
              : "native_push.receipt.missing",
            subjectType: "native_push_ticket",
            subjectId: ticket.id,
            metadata: { status, errorCode: code },
          },
          tx,
        );
        if (code === "DeviceNotRegistered")
          batchDisabled += await disableDevice(
            tx,
            ticket.installationId,
            ticket.tokenHash,
            ticket.id,
          );
        if (
          (!receipt && !expired) ||
          (receipt?.status === "error" &&
            code !== null &&
            !PERMANENT_ERRORS.includes(code))
        )
          batchRetry = true;
      }
      return {
        checked: tickets.length,
        disabled: batchDisabled,
        retry: batchRetry,
      };
    });
    checked += result.checked;
    disabled += result.disabled;
    retry ||= result.retry;
    if (result.checked < RECEIPT_BATCH_SIZE) break;
  }
  if (retry) throw new Error("Native push receipt checks incomplete");
  return { checked, disabled };
}
