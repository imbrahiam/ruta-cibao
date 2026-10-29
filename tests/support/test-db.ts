import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  categories,
  memberProfiles,
  municipalities,
  user,
} from "@/db/schema";
import { env } from "@/lib/env";
import { requireMember } from "@/modules/access/permissions";
import {
  type MemberViewer,
  toViewer,
  type Viewer,
} from "@/modules/access/viewer";
import type { AppContext } from "@/orpc/context";

/**
 * Integration suites run against a disposable loopback database named for
 * tests, never against local development data and never in production.
 */
export function assertDedicatedLocalDatabase(): void {
  const database = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !/(?:^|[-_])(test|tests)(?:$|[-_])/i.test(
      decodeURIComponent(database.pathname.slice(1)),
    ) ||
    database.searchParams.has("host") ||
    database.searchParams.has("hostaddr")
  ) {
    throw new Error(
      "Integration tests require a non-production loopback PostgreSQL database with a dedicated test name.",
    );
  }
}

export function context(
  viewer: Viewer,
  session: { id: string; createdAt: Date } = {
    id: "test-session",
    createdAt: new Date(),
  },
): AppContext {
  return {
    db,
    requestId: "test-request",
    headers: new Headers(),
    getViewer: async () => viewer,
    getSession: async () => {
      if (viewer.kind === "anonymous") {
        return { viewer, contact: null, session: null };
      }
      return {
        viewer,
        session,
        contact: {
          phoneNumber: null,
          phoneVerified: false,
          email: `${viewer.userId}@example.invalid`,
          emailVerified: true,
        },
      };
    },
    requireStaffSession: async () => {},
  } as AppContext;
}

/** A synthetic member (verified contact) with optional staff authority. */
export async function createMember(
  prefix: string,
  options: {
    staff?: { role: "moderator"; municipalityId: string } | { role: "admin" };
    municipalityId?: string;
    contactVerified?: boolean;
  } = {},
): Promise<{ viewer: MemberViewer; id: string }> {
  const id = `${prefix}-${crypto.randomUUID()}`;
  await db.insert(user).values({
    id,
    name: "Synthetic tester",
    email: `${id}@example.invalid`,
    emailVerified: options.contactVerified ?? true,
  });
  const [profile] = await db
    .insert(memberProfiles)
    .values({
      userId: id,
      displayName: `Synthetic ${id.slice(-6)}`,
      municipalityId: options.municipalityId ?? null,
      staffRole: options.staff?.role ?? "none",
      staffMunicipalityId:
        options.staff?.role === "moderator"
          ? options.staff.municipalityId
          : null,
    })
    .returning();
  const viewer = toViewer(id, profile, {
    image: null,
    contactVerified: options.contactVerified ?? true,
  });
  if (viewer.kind !== "member") throw new Error("Synthetic profile missing.");
  return {
    viewer: options.contactVerified === false ? viewer : requireMember(viewer),
    id,
  };
}

export async function auditsFor(userId: string, action: string) {
  return db
    .select()
    .from(auditEvents)
    .where(
      and(eq(auditEvents.actorUserId, userId), eq(auditEvents.action, action)),
    );
}

export async function removeCategories(ids: string[]) {
  if (ids.length > 0)
    await db.delete(categories).where(inArray(categories.id, ids));
}

export async function removeMunicipalities(ids: string[]) {
  if (ids.length > 0)
    await db.delete(municipalities).where(inArray(municipalities.id, ids));
}

/** Storage-touching suites also need a loopback path-style bucket named for tests. */
export function assertDedicatedLocalStorage(): void {
  const storage = new URL(env.S3_ENDPOINT);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(storage.hostname) ||
    !/(?:^|[-_])(test|tests)(?:$|[-_])/i.test(env.S3_BUCKET) ||
    !env.S3_FORCE_PATH_STYLE
  ) {
    throw new Error(
      "Storage tests require a loopback path-style S3 bucket with a dedicated test name.",
    );
  }
}
