/**
 * Cedula lookup against the Dominican civil registry (JCE).
 *
 * The upstream returns the full name registered to a cedula; it never returns
 * anything we can authenticate a person with. So a successful lookup proves the
 * cedula exists, not that the person entering it owns it — treat it as one
 * signal in onboarding, never as proof of identity on its own.
 *
 * Server-only: the upstream restricts CORS to another origin and the API key
 * must not reach a browser.
 *
 * Two upstream limits shape the design:
 *   - 50 *uncached* lookups per rolling hour, shared globally across all keys.
 *     Repeat lookups of the same cedula are free, so callers should persist the
 *     resolved name and never re-query to re-verify.
 *   - The service can be down. A lookup failure is a normal outcome here, not
 *     an exception: it degrades onboarding to "verification pending" instead of
 *     blocking a citizen from using the app.
 */

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { registryLookups } from "@/db/schema";
import { decryptSensitive, encryptSensitive, hashLookup } from "@/lib/crypto";
import { env } from "@/lib/env";
import { consumeRollingRateLimit } from "@/lib/rate-limit";

/**
 * The single definition of what a cédula is.
 *
 * Normalises the hyphenated form people actually type, then brands the result
 * so a raw string cannot be passed where a validated cédula is expected. The
 * message is a catalogue key, not a sentence — user-facing text lives in
 * `messages/`.
 */
export const cedulaSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{11}$/, "validation.cedula.format"))
  .brand<"Cedula">();

export type Cedula = z.infer<typeof cedulaSchema>;

/** Parses user input into a cedula, normalising the hyphens people type. */
export function parseCedula(input: string) {
  return cedulaSchema.safeParse(input);
}

export type JceLookup =
  | { status: "found"; cedula: Cedula; fullName: string }
  | { status: "not_found"; cedula: Cedula }
  /** Upstream could not answer. The caller retries later; it must not block. */
  | {
      status: "unavailable";
      cedula: Cedula;
      reason: string;
      retryAfter?: Date;
    };

const foundSchema = z.object({
  name: z.string().min(1),
  document_id: z.string(),
  cached: z.boolean().optional(),
});

const rateLimitSchema = z.object({ reset_at: z.number().int().optional() });

const LOOKUP_TIMEOUT_MS = 10_000;

async function lookupLive(cedula: Cedula): Promise<JceLookup> {
  let response: Response;
  try {
    response = await fetch(`${env.JCE_API_URL}/api/cedula/${cedula}`, {
      headers: { "x-api-key": env.JCE_API_KEY },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network error";
    return { status: "unavailable", cedula, reason };
  }

  if (response.status === 404) {
    return { status: "not_found", cedula };
  }

  if (response.status === 429) {
    const body = rateLimitSchema.safeParse(
      await response.json().catch(() => ({})),
    );
    const resetAt =
      body.success && body.data.reset_at
        ? new Date(body.data.reset_at * 1000)
        : undefined;
    return {
      status: "unavailable",
      cedula,
      reason: "rate limit exceeded",
      retryAfter: resetAt,
    };
  }

  if (!response.ok) {
    return {
      status: "unavailable",
      cedula,
      reason: `upstream returned ${response.status}`,
    };
  }

  const parsed = foundSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return {
      status: "unavailable",
      cedula,
      reason: "unexpected upstream response shape",
    };
  }

  return { status: "found", cedula, fullName: parsed.data.name };
}

/**
 * Fixture used by CI, offline development and the demo, so none of those spend
 * the shared hourly quota. Any cedula ending in 0 is treated as unknown.
 */
async function lookupMock(cedula: Cedula): Promise<JceLookup> {
  if (cedula.endsWith("0")) {
    return { status: "not_found", cedula };
  }
  return { status: "found", cedula, fullName: "JUAN ANTONIO PEREZ MARTINEZ" };
}

export async function lookupCedula(cedula: Cedula): Promise<JceLookup> {
  if (env.JCE_USE_MOCK) return lookupMock(cedula);
  const key = hashLookup("registry-cedula", cedula);
  const reservation = await db.transaction(
    async (tx): Promise<JceLookup | null> => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
      );
      const [cached] = await tx
        .select()
        .from(registryLookups)
        .where(eq(registryLookups.key, key))
        .limit(1);
      if (cached?.status === "not_found")
        return { status: "not_found", cedula };
      if (cached?.status === "found" && cached.nameCiphertext)
        return {
          status: "found",
          cedula,
          fullName: decryptSensitive(cached.nameCiphertext),
        };
      if (cached && Date.now() - cached.resolvedAt.getTime() < 60_000) {
        return {
          status: "unavailable",
          cedula,
          reason: "lookup already reserved",
          retryAfter: new Date(cached.resolvedAt.getTime() + 60_000),
        };
      }
      const budget = await consumeRollingRateLimit(
        "all",
        { scope: "jce-global", limit: 47, windowMs: 3_600_000 },
        tx,
      );
      if (!budget.allowed)
        return {
          status: "unavailable",
          cedula,
          reason: "platform quota reserved",
          retryAfter: new Date(Date.now() + budget.retryAfterSeconds * 1000),
        };
      await tx
        .insert(registryLookups)
        .values({ key, status: "pending" })
        .onConflictDoUpdate({
          target: registryLookups.key,
          set: { status: "pending", resolvedAt: new Date() },
        });
      return null;
    },
  );
  if (reservation) return reservation;
  // Commit the quota reservation before the network call. A later domain
  // rollback must never refund a lookup already spent at the upstream.
  const result = await lookupLive(cedula);
  if (result.status !== "unavailable") {
    await db
      .update(registryLookups)
      .set({
        status: result.status,
        nameCiphertext:
          result.status === "found" ? encryptSensitive(result.fullName) : null,
        resolvedAt: new Date(),
      })
      .where(eq(registryLookups.key, key));
  }
  return result;
}
