import { ORPCError } from "@orpc/server";
import type { RequestDeletionInput } from "@ruta/contracts";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { type Db, type DbTransaction, db } from "@/db";
import {
  accountDeletions,
  consultations,
  contentReports,
  ecoRoutes,
  memberProfiles,
  nativePushDevices,
  photoUploads,
  placePhotos,
  placeReports,
  places,
  realtimeEvents,
  session,
  trafficReports,
  user,
  verification,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { decryptSensitive, encryptSensitive } from "@/lib/crypto";
import { env } from "@/lib/env";
import { withIdempotency } from "@/lib/idempotency";
import { drainOutbox, enqueueJob } from "@/lib/jobs/outbox";
import { QUEUES } from "@/lib/jobs/queues";
import { errorDetails, logError } from "@/lib/log";
import { publishRealtimeEvent, userChannel } from "@/lib/realtime";
import { deleteObject, listObjectKeys, putObject } from "@/lib/storage";
import { refreshPublicCaches } from "@/lib/web-cache";
import { profilePhotoPrefix } from "@/modules/access/profile-photo";
import type { SessionInfo } from "@/modules/access/session";
import type { MemberViewer } from "@/modules/access/viewer";
import {
  revokeOfflineSnapshots,
  scheduleOfflineSnapshotRebuild,
} from "@/modules/offline/snapshot";

/**
 * Deleting an account for real.
 *
 * Requesting is one short transaction: it captures an encrypted inventory of
 * what the account contributed, writes the receipt, bans the account so it can
 * neither sign in nor act, revokes its sessions, stops push delivery and queues
 * the cleanup. Nothing is destroyed until the cleanup job runs, and the job is
 * safe to repeat: every step either finds its work already done or does it
 * again.
 *
 * The cleanup removes what the person wrote and shared (places, routes,
 * traffic reports, cases, photographs, claims, saved places, passport stamps,
 * push tokens) and then the account itself. What belongs to the institution
 * survives without the person: official responses, audit outcomes with no
 * personal data, and a directory record kept alive by another verified owner,
 * stripped of this person's text, photographs and contact details.
 */

const FRESH_SESSION_MS = 5 * 60_000;
const LEDGER_PREFIX = "deletion-ledger/";

export type DeletionReason =
  | "recent_authentication_required"
  | "last_administrator";

/** Storage keys that point at real objects (seeded imagery uses public paths). */
function isObjectKey(value: string | null | undefined): value is string {
  return (
    Boolean(value) && !value?.startsWith("/") && !/^https?:/i.test(value ?? "")
  );
}

type Inventory = {
  version: 1;
  placeIds: string[];
  routeIds: string[];
  trafficReportIds: string[];
  consultationIds: string[];
  /** Every object this account's content points at, at request time. */
  objectKeys: string[];
};

type Executor = Db | DbTransaction;

/** Everything that was uploaded by, or hangs off a place created by, the account. */
async function collectObjectKeys(
  executor: Executor,
  userId: string,
): Promise<string[]> {
  const keys = new Set<string>();
  const [profile] = await executor
    .select({ staffRole: memberProfiles.staffRole })
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, userId))
    .limit(1);
  const institutional = profile !== undefined && profile.staffRole !== "none";

  if (institutional) {
    // What staff published belongs to the institution and stays; only
    // reservations that never became a photograph are cleaned up.
    const reservations = await executor
      .select({ key: photoUploads.storageKey })
      .from(photoUploads)
      .where(
        and(eq(photoUploads.userId, userId), isNull(photoUploads.finalKey)),
      );
    for (const row of reservations) if (isObjectKey(row.key)) keys.add(row.key);
    return [...keys].sort();
  }

  const own = await executor
    .select({ key: placePhotos.storageKey })
    .from(placePhotos)
    .where(eq(placePhotos.uploadedByUserId, userId));
  for (const row of own) if (isObjectKey(row.key)) keys.add(row.key);

  const uploads = await executor
    .select({ key: photoUploads.storageKey, finalKey: photoUploads.finalKey })
    .from(photoUploads)
    .where(eq(photoUploads.userId, userId));
  for (const row of uploads) {
    if (isObjectKey(row.key)) keys.add(row.key);
    if (isObjectKey(row.finalKey)) keys.add(row.finalKey);
  }

  // Photographs and imagery of places that will be removed with the account.
  const removable = await executor
    .select({ id: places.id, imageUrl: places.imageUrl })
    .from(places)
    .where(
      and(
        eq(places.createdByUserId, userId),
        sql`not ${isMaintainedElsewhere(userId)}`,
      ),
    );
  for (const place of removable) {
    if (isObjectKey(place.imageUrl)) keys.add(place.imageUrl);
  }
  if (removable.length > 0) {
    const attached = await executor
      .select({ key: placePhotos.storageKey })
      .from(placePhotos)
      .where(
        inArray(
          placePhotos.placeId,
          removable.map((place) => place.id),
        ),
      );
    for (const row of attached) if (isObjectKey(row.key)) keys.add(row.key);
  }
  return [...keys].sort();
}

/**
 * Whether a place the account created is kept alive by somebody else: another
 * account holds an approved ownership claim on it. Staff accounts speak for the
 * institution, so everything they created is kept (handled by the caller).
 */
function isMaintainedElsewhere(userId: string) {
  // Explicit table names: a single-table select renders unqualified columns,
  // which a correlated subquery would resolve against its own table.
  return sql`exists (select 1 from business_claims bc where bc.place_id = "places"."id" and bc.status = 'approved' and bc.claimant_user_id <> ${userId})`;
}

async function captureInventory(
  executor: Executor,
  userId: string,
): Promise<Inventory> {
  // Sequential: a transaction owns one connection and cannot overlap queries.
  const placeRows = await executor
    .select({ id: places.id })
    .from(places)
    .where(eq(places.createdByUserId, userId));
  const routeRows = await executor
    .select({ id: ecoRoutes.id })
    .from(ecoRoutes)
    .where(eq(ecoRoutes.submittedByUserId, userId));
  const trafficRows = await executor
    .select({ id: trafficReports.id })
    .from(trafficReports)
    .where(eq(trafficReports.reportedByUserId, userId));
  const consultationRows = await executor
    .select({ id: consultations.id })
    .from(consultations)
    .where(eq(consultations.openedByUserId, userId));
  return {
    version: 1,
    placeIds: placeRows.map((row) => row.id),
    routeIds: routeRows.map((row) => row.id),
    trafficReportIds: trafficRows.map((row) => row.id),
    consultationIds: consultationRows.map((row) => row.id),
    objectKeys: await collectObjectKeys(executor, userId),
  };
}

export async function requestAccountDeletion(
  viewer: MemberViewer,
  authSession: SessionInfo,
  input: RequestDeletionInput,
) {
  // A signed-in phone is not proof the owner is holding it: the session has to
  // have been created by a code entered in the last few minutes.
  if (Date.now() - authSession.createdAt.getTime() > FRESH_SESSION_MS) {
    throw new ORPCError("FORBIDDEN", {
      message: "Confirm your phone or email again to delete the account.",
      data: {
        reason: "recent_authentication_required" satisfies DeletionReason,
      },
    });
  }

  const outcome = await withIdempotency({
    key: `account:deletion:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [existing] = await tx
        .select({ id: accountDeletions.id })
        .from(accountDeletions)
        .where(eq(accountDeletions.userId, viewer.userId))
        .limit(1);
      if (existing) return { deletionId: existing.id };

      // Somebody has to keep the keys: the last administrator hands over first.
      if (viewer.profile.staffRole === "admin") {
        const [otherAdmin] = await tx
          .select({ userId: memberProfiles.userId })
          .from(memberProfiles)
          .innerJoin(user, eq(user.id, memberProfiles.userId))
          .where(
            and(
              eq(memberProfiles.staffRole, "admin"),
              ne(memberProfiles.userId, viewer.userId),
              or(eq(user.banned, false), sql`${user.banned} is null`),
            ),
          )
          .limit(1);
        if (!otherAdmin) {
          throw new ORPCError("FORBIDDEN", {
            message:
              "Appoint another administrator before deleting this account.",
            data: { reason: "last_administrator" satisfies DeletionReason },
          });
        }
      }

      const inventory = await captureInventory(tx, viewer.userId);
      await tx.insert(accountDeletions).values({
        id: input.requestId,
        userId: viewer.userId,
        inventoryCiphertext: encryptSensitive(JSON.stringify(inventory)),
      });

      // From here the account can neither sign in nor act: sessions are gone
      // and the ban stops a new code from opening another one.
      await tx
        .update(user)
        .set({ banned: true, banReason: "account_deletion", banExpires: null })
        .where(eq(user.id, viewer.userId));
      await tx.delete(session).where(eq(session.userId, viewer.userId));
      await tx
        .delete(nativePushDevices)
        .where(eq(nativePushDevices.userId, viewer.userId));

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "account.deletion_requested",
          subjectType: "account_deletion",
          subjectId: input.requestId,
        },
        tx,
      );
      await enqueueJob(tx, QUEUES.accountDeletion, {
        deletionId: input.requestId,
      });
      return { deletionId: input.requestId };
    },
  });

  // Without a worker the queued job runs here; with one it is picked up in seconds.
  if (!env.JOBS_ENABLED) {
    await drainOutbox().catch((error) => {
      logError("account.deletion_inline_failed", errorDetails(error));
    });
  }

  return { deletionId: outcome.result.deletionId, status: "pending" as const };
}

export async function accountDeletionStatus(deletionId: string) {
  const [row] = await db
    .select({ status: accountDeletions.status })
    .from(accountDeletions)
    .where(eq(accountDeletions.id, deletionId))
    .limit(1);
  if (!row) {
    throw new ORPCError("NOT_FOUND", {
      message: "No deletion with that receipt.",
      data: { reason: "not_found" },
    });
  }
  return { status: row.status };
}

/** The removal itself, in one transaction. Returns what the caller must announce. */
async function purge(tx: DbTransaction, userId: string) {
  const [profile] = await tx
    .select({ staffRole: memberProfiles.staffRole })
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, userId))
    .limit(1);
  // Staff speak for the institution: what they created stays, detached from them.
  const institutional = profile !== undefined && profile.staffRole !== "none";
  const removedPlaces: { id: string; municipalityId: string }[] = [];

  const created = await tx
    .select({
      id: places.id,
      municipalityId: places.municipalityId,
      kept: sql<boolean>`${institutional} or ${isMaintainedElsewhere(userId)}`,
    })
    .from(places)
    .where(eq(places.createdByUserId, userId));

  const kept = created.filter((place) => place.kept).map((place) => place.id);
  const removed = created.filter((place) => !place.kept);

  if (kept.length > 0) {
    if (!institutional) {
      // Another owner keeps the record: name, place and category stay, this
      // person's narrative, address, contact details, imagery and photographs go.
      await tx
        .update(places)
        .set({
          description: null,
          address: null,
          businessDetails: null,
          reviewNote: null,
          imageUrl: sql`case when ${places.imageUrl} like '/%' or ${places.imageUrl} ilike 'http%' then ${places.imageUrl} else null end`,
        })
        .where(inArray(places.id, kept));
    }
    await tx
      .update(places)
      .set({ createdByUserId: null })
      .where(inArray(places.id, kept));
  }
  if (removed.length > 0) {
    // Cascades photographs, correction requests, saves, confirmations and claims.
    await tx.delete(places).where(
      inArray(
        places.id,
        removed.map((place) => place.id),
      ),
    );
    removedPlaces.push(...removed);
  }

  // Photographs the account added to places it does not own.
  if (!institutional) {
    await tx
      .delete(placePhotos)
      .where(eq(placePhotos.uploadedByUserId, userId));
  }
  // Free text from correction and content reports goes; the outcomes stay.
  await tx
    .update(placeReports)
    .set({ details: null })
    .where(eq(placeReports.reporterUserId, userId));
  await tx
    .update(contentReports)
    .set({ details: null })
    .where(eq(contentReports.reporterUserId, userId));
  await tx
    .update(contentReports)
    .set({
      status: "actioned",
      decisionReason: "The author's account was deleted with its content.",
      reviewedAt: new Date(),
    })
    .where(
      and(
        eq(contentReports.authorUserId, userId),
        eq(contentReports.status, "open"),
      ),
    );

  const removedTraffic: {
    id: string;
    municipalityId: string;
    location: { x: number; y: number };
    status: string;
  }[] = [];
  const removedRoutes: { id: string; municipalityId: string }[] = [];
  if (!institutional) {
    removedRoutes.push(
      ...(await tx
        .delete(ecoRoutes)
        .where(eq(ecoRoutes.submittedByUserId, userId))
        .returning({
          id: ecoRoutes.id,
          municipalityId: ecoRoutes.municipalityId,
        })),
    );
    removedTraffic.push(
      ...(await tx
        .delete(trafficReports)
        .where(eq(trafficReports.reportedByUserId, userId))
        .returning({
          id: trafficReports.id,
          municipalityId: trafficReports.municipalityId,
          location: trafficReports.location,
          status: trafficReports.status,
        })),
    );
  }

  // Cases: a case nobody answered goes entirely; one with official responses
  // keeps only a redacted shell so the institution's replies and audit remain.
  const cases = await tx
    .select({
      id: consultations.id,
      municipalityId: consultations.municipalityId,
      answered: sql<boolean>`exists (select 1 from consultation_responses cr where cr.consultation_id = "consultations"."id")`,
    })
    .from(consultations)
    .where(eq(consultations.openedByUserId, userId));
  const answeredIds = cases.filter((row) => row.answered).map((row) => row.id);
  const unansweredIds = cases
    .filter((row) => !row.answered)
    .map((row) => row.id);
  if (answeredIds.length > 0) {
    await tx
      .update(consultations)
      .set({
        title: "",
        body: "",
        location: null,
        openedByUserId: null,
        publicationStatus: "hidden",
      })
      .where(inArray(consultations.id, answeredIds));
  }
  if (unansweredIds.length > 0) {
    await tx
      .delete(consultations)
      .where(inArray(consultations.id, unansweredIds));
  }

  // Their own private stream, then the contact traces the sign-in left behind.
  await tx
    .delete(realtimeEvents)
    .where(eq(realtimeEvents.channel, userChannel(userId)));
  const [account] = await tx
    .select({ phone: user.phoneNumber, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (account) {
    const identifiers = [account.phone, account.email].filter(
      (value): value is string => Boolean(value),
    );
    for (const identifier of identifiers) {
      await tx
        .delete(verification)
        .where(
          or(
            eq(verification.identifier, identifier),
            sql`${verification.identifier} like ${`%${identifier}`}`,
          ),
        );
    }
  }

  // Saved places, votes, confirmations, passport stamps, claims, blocks, push
  // tokens, preferences, notifications, idempotency records, profile and the
  // authentication records all cascade from the account row.
  await tx.delete(user).where(eq(user.id, userId));

  for (const place of removedPlaces) {
    await publishRealtimeEvent(
      {
        channel: "places",
        municipalityId: place.municipalityId,
        subjectType: "place",
        subjectId: place.id,
        action: "deleted",
      },
      tx,
    );
  }
  for (const route of removedRoutes) {
    await publishRealtimeEvent(
      {
        channel: "routes",
        municipalityId: route.municipalityId,
        subjectType: "route",
        subjectId: route.id,
        action: "deleted",
      },
      tx,
    );
  }
  for (const report of removedTraffic) {
    if (report.status !== "active") continue;
    await publishRealtimeEvent(
      {
        channel: "traffic",
        municipalityId: report.municipalityId,
        subjectType: "traffic_report",
        subjectId: report.id,
        action: "deleted",
        payload: { reason: "removed" },
        location: report.location,
      },
      tx,
    );
  }
  for (const row of cases) {
    await publishRealtimeEvent(
      {
        channel: "consultations",
        municipalityId: row.municipalityId,
        subjectType: "consultation",
        subjectId: row.id,
        action: "deleted",
      },
      tx,
    );
  }

  return {
    placesRemoved: removedPlaces.length,
    placesKept: kept.length,
    routes: removedRoutes.length,
    traffic: removedTraffic.length,
    casesRemoved: unansweredIds.length,
    casesRedacted: answeredIds.length,
  };
}

/**
 * The cleanup job. Re-runnable until the receipt reads `completed`.
 *
 * Objects go first, and the account's content rows stay in place until they
 * have: if storage fails, nothing is lost track of and the retry finds the same
 * keys. The ledger entry is written before the receipt is marked complete, so
 * `completed` always means "actually gone, and a restore knows it".
 */
export async function runAccountDeletion(deletionId: string) {
  const [row] = await db
    .select()
    .from(accountDeletions)
    .where(eq(accountDeletions.id, deletionId))
    .limit(1);
  if (!row) return { status: "missing" as const };
  if (row.status === "completed") return { status: "completed" as const };
  if (!row.inventoryCiphertext)
    throw new Error("Pending deletion without an inventory.");

  await db
    .update(accountDeletions)
    .set({ attempts: sql`${accountDeletions.attempts} + 1` })
    .where(eq(accountDeletions.id, deletionId));

  const inventory = JSON.parse(
    decryptSensitive(row.inventoryCiphertext),
  ) as Inventory;
  const userId = row.userId;
  const profilePhotos = await listObjectKeys(profilePhotoPrefix(userId));

  let summary: Awaited<ReturnType<typeof purge>> | null = null;
  for (let pass = 0; pass < 3 && !summary; pass++) {
    // Keys captured at request time plus whatever exists now.
    const keys = new Set([
      ...inventory.objectKeys,
      ...profilePhotos,
      ...(await collectObjectKeys(db, userId)),
    ]);
    for (const key of keys) await deleteObject(key);

    summary = await db.transaction(async (tx) => {
      // Anything that appeared since the sweep (an upload in flight when the
      // account was banned) sends us round again instead of leaving an orphan.
      const fresh = await collectObjectKeys(tx, userId);
      if (fresh.some((key) => !keys.has(key))) return null;
      return purge(tx, userId);
    });
  }
  if (!summary)
    throw new Error("Account content kept changing during deletion.");

  const completedAt = new Date();
  await putObject(
    `${LEDGER_PREFIX}${deletionId}.json`,
    new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        deletionId,
        userId,
        completedAt: completedAt.toISOString(),
      }),
    ),
    "application/json",
  );

  await db.transaction(async (tx) => {
    await tx
      .update(accountDeletions)
      .set({ status: "completed", inventoryCiphertext: null, completedAt })
      .where(eq(accountDeletions.id, deletionId));
    await recordAudit(
      {
        action: "account.deleted",
        subjectType: "account_deletion",
        subjectId: deletionId,
        metadata: summary,
      },
      tx,
    );
    await revokeOfflineSnapshots("account_deleted", tx);
    await scheduleOfflineSnapshotRebuild(tx);
  });

  await refreshPublicCaches();
  return { status: "completed" as const, ...summary };
}

export type DeletionTombstone = {
  version: 1;
  deletionId: string;
  userId: string;
  completedAt: string;
};

/** Reads one ledger object back into a tombstone, or null when it is not one. */
export function parseTombstone(bytes: Uint8Array): DeletionTombstone | null {
  try {
    const value = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as Partial<DeletionTombstone>;
    if (
      value.version === 1 &&
      typeof value.deletionId === "string" &&
      typeof value.userId === "string" &&
      typeof value.completedAt === "string"
    ) {
      return value as DeletionTombstone;
    }
  } catch {
    // expected: the value is not a tombstone.
  }
  return null;
}

/**
 * Re-applies a recorded deletion to a database that was restored from a backup
 * taken before it happened. Restore automation runs this for every ledger entry
 * before the restored system is made public, so nobody who asked to be deleted
 * comes back. Safe to run any number of times.
 */
export async function reapplyDeletionTombstone(tombstone: DeletionTombstone) {
  const [account] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, tombstone.userId))
    .limit(1);

  if (!account) {
    // Already absent: make sure the receipt exists and reads completed.
    await db
      .insert(accountDeletions)
      .values({
        id: tombstone.deletionId,
        userId: tombstone.userId,
        status: "completed",
        completedAt: new Date(tombstone.completedAt),
      })
      .onConflictDoNothing();
    return { userId: tombstone.userId, status: "already_absent" as const };
  }

  const deletionId = await db.transaction(async (tx) => {
    const inventory = encryptSensitive(
      JSON.stringify(await captureInventory(tx, tombstone.userId)),
    );
    const [row] = await tx
      .insert(accountDeletions)
      .values({
        id: tombstone.deletionId,
        userId: tombstone.userId,
        inventoryCiphertext: inventory,
      })
      .onConflictDoUpdate({
        target: accountDeletions.userId,
        set: {
          status: "pending",
          inventoryCiphertext: inventory,
          completedAt: null,
        },
      })
      .returning({ id: accountDeletions.id });
    await tx
      .update(user)
      .set({ banned: true, banReason: "account_deletion", banExpires: null })
      .where(eq(user.id, tombstone.userId));
    await tx.delete(session).where(eq(session.userId, tombstone.userId));
    return row?.id ?? tombstone.deletionId;
  });

  await runAccountDeletion(deletionId);
  return { userId: tombstone.userId, status: "reapplied" as const };
}

export { LEDGER_PREFIX };
