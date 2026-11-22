/** Native push over APNs and FCM. Acceptance is not a human read acknowledgement. */
import { sign } from "node:crypto";
import { type ClientHttp2Session, connect } from "node:http2";
import { appTargetHref, parseAppTarget } from "@ruta/shared/app-target";
import { catalogues } from "@ruta/shared/messages";
import { and, asc, eq, inArray, isNotNull, notExists, or } from "drizzle-orm";
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
import { isFcmEnabled, sendToFcm } from "@/lib/fcm";
import { logInfo } from "@/lib/log";

const SEND_BATCH_SIZE = 100;
const REQUEST_TIMEOUT_MS = 10_000;
/** APNs accepts a provider token for an hour; renew well before. */
const JWT_LIFETIME_MS = 40 * 60_000;
/** Reasons that mean this token will never work again: disable the device. */
const PERMANENT_ERRORS = [
  "Unregistered",
  "BadDeviceToken",
  "DeviceTokenNotForTopic",
  "FcmUNREGISTERED",
  "FcmSENDER_ID_MISMATCH",
  "FcmInvalidToken",
  // Stored under a key that no longer decrypts it: no retry will ever send.
  "TokenUnreadable",
];
const providerErrorCodes = new Set([
  ...PERMANENT_ERRORS,
  "TooManyRequests",
  "InvalidProviderToken",
  "ExpiredProviderToken",
  "MissingProviderToken",
  "TopicDisallowed",
  "InternalServerError",
  "ServiceUnavailable",
  "Shutdown",
]);

type ProviderTicket =
  | { status: "ok"; id: string }
  | { status: "error"; code: string };
type Device = Pick<
  typeof nativePushDevices.$inferSelect,
  "installationId" | "tokenHash" | "tokenCiphertext" | "platform"
>;

export type PushPayload = { notificationId: string; href?: string };

function isApnsEnabled(): boolean {
  return Boolean(
    env.APNS_KEY_ID &&
      env.APNS_TEAM_ID &&
      env.APNS_PRIVATE_KEY &&
      env.APNS_TOPIC,
  );
}

export function isPushEnabled(): boolean {
  return isApnsEnabled() || isFcmEnabled();
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

// ── APNs ──────────────────────────────────────────────────────────────────

let providerToken: { value: string; issuedAt: number } | undefined;

/** The ES256 provider JWT APNs expects, cached for most of its hour. */
function apnsJwt(): string {
  const now = Date.now();
  if (providerToken && now - providerToken.issuedAt < JWT_LIFETIME_MS)
    return providerToken.value;
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({ iss: env.APNS_TEAM_ID, iat: Math.floor(now / 1000) }),
  ).toString("base64url");
  const key = (env.APNS_PRIVATE_KEY ?? "").replaceAll("\\n", "\n");
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), {
    key,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  const value = `${header}.${claims}.${signature}`;
  providerToken = { value, issuedAt: now };
  return value;
}

function apnsOrigin(): string {
  const environment =
    env.APNS_ENVIRONMENT ??
    (env.NODE_ENV === "production" ? "production" : "sandbox");
  return environment === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
}

/** One HTTP/2 request to APNs; every outcome becomes a ticket, never a throw. */
function sendToApns(
  session: ClientHttp2Session,
  token: string,
  body: string,
): Promise<ProviderTicket> {
  return new Promise((resolve) => {
    const request = session.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsJwt()}`,
      "apns-topic": env.APNS_TOPIC ?? "",
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 86_400),
      "content-type": "application/json",
    });
    let status = 0;
    let apnsId = "";
    let reply = "";
    const timer = setTimeout(() => {
      request.close();
      resolve({ status: "error", code: "ServiceUnavailable" });
    }, REQUEST_TIMEOUT_MS);
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
      apnsId = String(headers["apns-id"] ?? "");
    });
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      reply += chunk;
    });
    request.on("end", () => {
      clearTimeout(timer);
      if (status === 200 && apnsId)
        return resolve({ status: "ok", id: apnsId });
      let value: unknown;
      try {
        value = reply ? JSON.parse(reply) : {};
      } catch {
        value = {};
      }
      const parsed = z
        .object({ reason: z.string().optional() })
        .safeParse(value);
      // A 410 is always "this device is gone", whatever the reason says.
      const reason =
        status === 410
          ? "Unregistered"
          : parsed.success
            ? parsed.data.reason
            : undefined;
      if (reason === "ExpiredProviderToken") providerToken = undefined;
      resolve({ status: "error", code: errorCode(reason) });
    });
    request.on("error", () => {
      clearTimeout(timer);
      resolve({ status: "error", code: "ServiceUnavailable" });
    });
    request.end(body);
  });
}

async function disableDevice(
  tx: DbTransaction,
  installationId: string,
  tokenHash: string,
  ticketId: string,
  reason: string,
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
        metadata: { reason, ticketId },
      },
      tx,
    );
  return disabled.length;
}

async function storeTicket(
  tx: DbTransaction,
  notificationId: string,
  device: Device,
  ticket: ProviderTicket,
): Promise<{ accepted: number; retry: boolean }> {
  const code = ticket.status === "error" ? ticket.code : null;
  const outcome = {
    providerMessageId: ticket.status === "ok" ? ticket.id : null,
    // APNs answers synchronously: accepted is final, there is no receipt.
    status: ticket.status,
    errorCode: code,
    checkAfter: new Date(),
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
  if (code && PERMANENT_ERRORS.includes(code))
    await disableDevice(
      tx,
      device.installationId,
      device.tokenHash,
      stored.id,
      code,
    );
  return {
    accepted: ticket.status === "ok" ? 1 : 0,
    retry: code !== null && !PERMANENT_ERRORS.includes(code),
  };
}

/** Retry only devices whose notification APNs has not already accepted. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!isPushEnabled()) {
    logInfo("native_push.send.skipped");
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
          platform: nativePushDevices.platform,
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
                      isNotNull(nativePushTickets.providerMessageId),
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
      const configured = pending.filter((device) =>
        device.platform === "ios" ? isApnsEnabled() : isFcmEnabled(),
      );
      if (!configured.length) return { accepted: 0, retry: false };
      const body = JSON.stringify({
        aps: {
          alert: {
            title: catalogue("notifications.title"),
            body: catalogue("notifications.pushGeneric"),
          },
          sound: "default",
          "thread-id": "notifications",
        },
        ...data,
      });
      const session = configured.some((device) => device.platform === "ios")
        ? connect(apnsOrigin())
        : undefined;
      session?.on("error", () => {});
      let batchAccepted = 0;
      let batchRetry = false;
      try {
        for (const device of configured) {
          let token: string;
          try {
            token = decryptSensitive(device.tokenCiphertext);
          } catch {
            // Thrown, it would roll back the tickets of devices already sent
            // in this batch and the retry would push to them again.
            const stored = await storeTicket(tx, notificationId, device, {
              status: "error",
              code: "TokenUnreadable",
            });
            batchRetry ||= stored.retry;
            continue;
          }
          const ticket =
            device.platform === "ios" && session
              ? await sendToApns(session, token, body)
              : await sendToFcm(
                  token,
                  data,
                  catalogue("notifications.title"),
                  catalogue("notifications.pushGeneric"),
                );
          const stored = await storeTicket(tx, notificationId, device, ticket);
          batchAccepted += stored.accepted;
          batchRetry ||= stored.retry;
        }
      } finally {
        session?.close();
      }
      return { accepted: batchAccepted, retry: batchRetry };
    });
    accepted += result.accepted;
    retry ||= result.retry;
  }
  if (retry) throw new Error("Native push delivery incomplete");
  return accepted;
}

/**
 * APNs reports each delivery in its response, so there are no receipts to
 * poll; the job stays scheduled and returns nothing to do.
 */
export async function checkNativePushReceipts(): Promise<{
  checked: number;
  disabled: number;
}> {
  return { checked: 0, disabled: 0 };
}
